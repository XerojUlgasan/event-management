import {
  MAX_QUOTATION_AMOUNT_MINOR,
  type Quotation,
  type QuotationAddonItem,
  type QuotationItem,
} from "@event-management/contracts/quotations";
import { z } from "@hono/zod-openapi";
import type { Selectable } from "kysely";
import { itemSchema } from "../../controllers/quotations/schemas.js";
import type { BookingRequests, Quotations } from "../../db/types.js";

import {
  centavosToPesos,
  pesosToCentavos,
} from "@event-management/contracts/money";
import { serviceError } from "../../utils/service-result.js";

export const failure = (message: string, status: 400 | 404 | 409) =>
  serviceError(message, status);

type Quote = Selectable<Quotations> & { revision: string };

const iso = (v: Date | null) => v?.toISOString() ?? null;

export function amount(base: number, items: QuotationItem[]) {
  const value = items.reduce((sum, item) => {
    const lineAmount = item.amountMinor ?? 0;

    return sum + (item.direction === "add" ? lineAmount : -lineAmount);
  }, base);

  return Number.isSafeInteger(value) &&
    value >= -MAX_QUOTATION_AMOUNT_MINOR - 1 &&
    value <= MAX_QUOTATION_AMOUNT_MINOR
    ? value
    : null;
}

export function basePrice(price: number) {
  const value = pesosToCentavos(price);

  return Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_QUOTATION_AMOUNT_MINOR
    ? value
    : null;
}

export function quotationItems(items: Quote["items"]): QuotationItem[] {
  return z.array(itemSchema).parse(items);
}

export function dto(row: Quote): Quotation {
  return {
    id: row.id,
    bookingRequestId: row.booking_request_id,
    version: row.version,
    currency: "PHP",
    baseAmountMinor: row.base_amount_minor,
    totalAmountMinor: row.total_amount_minor,
    status: row.status as Quotation["status"],
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.revision,
    sentAt: iso(row.sent_at),
    supersededAt: iso(row.superseded_at),
    offeredPackageId: row.offered_package_id,
    adjustmentsReviewed: row.adjustments_reviewed,
    previousQuotationId: row.previous_quotation_id,
    revisionReason: row.revision_reason,
    items: quotationItems(row.items),
  };
}

const php = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

function agreedAddonDescription(item: QuotationAddonItem) {
  const { source, hours, fixedPriceOverrideMinor, hourlyRateOverrideMinor } =
    item.addon;
  const fixed = source.includedHours !== null;
  const price = fixedPriceOverrideMinor ?? source.fixedPriceMinor;
  const rate = hourlyRateOverrideMinor ?? source.hourlyRateMinor;
  const terms = [];

  if (fixed && price !== null)
    terms.push(
      `${php.format(centavosToPesos(price))} for ${source.includedHours} included ${source.includedHours === 1 ? "hour" : "hours"}`,
    );

  if (rate !== null) {
    const billedHours = hours ?? 0;
    const unit = billedHours === 1 ? "hour" : "hours";
    terms.push(
      `${billedHours} ${fixed ? "extra " : ""}${unit} × ${php.format(centavosToPesos(rate))}/hour`,
    );
  }

  return `${item.description} (${terms.join(" · ")})`;
}

export function customerDto(row: Quote): Quotation {
  const quotation = dto(row);

  return {
    ...quotation,
    items: quotation.items.map((item) => {
      if (!item.addon) return item;

      if (item.amountMinor === null)
        throw new Error("Delivered quotation has an unpriced add-on");

      return {
        id: item.id,
        direction: item.direction,
        kind: item.kind,
        description: agreedAddonDescription(item),
        amountMinor: item.amountMinor,
        serviceId: item.serviceId,
      };
    }),
  };
}

export const closed = (booking: Pick<Selectable<BookingRequests>, "status">) =>
  ["declined", "cancelled"].includes(booking.status);
