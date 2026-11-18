import type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";
import { z } from "@hono/zod-openapi";
import type { Selectable, Transaction } from "kysely";
import { itemSchema } from "../../controllers/quotations/schemas.js";
import { createAuditEventData } from "../../data/audit/create-audit-event.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { resolveBookingPackageData } from "../../data/booking-requests/resolve-booking-package.js";
import { lockAnyPackageData } from "../../data/booking-requests/lock-any-package.js";
import {
  findQuoteData,
  lockQuoteData,
} from "../../data/quotations/find-quotation.js";
import type { BookingRequests, DB, Quotations } from "../../db/types.js";

import { pesosToCentavos } from "@event-management/contracts/money";
import { serviceError } from "../../utils/service-result.js";

export const failure = (message: string, status: 400 | 404 | 409) =>
  serviceError(message, status);
type Booking = Selectable<BookingRequests> & { revision: string };
type Quote = Selectable<Quotations> & { revision: string };
const iso = (v: Date | null) => v?.toISOString() ?? null;
export async function proposalPackage(trx: Transaction<DB>, booking: Booking) {
  const resolved = await resolveBookingPackageData(trx, booking);
  if (!resolved) return null;
  const pkg = await lockAnyPackageData(trx, resolved.id);
  if (!pkg) throw new Error("Linked package not found");
  return pkg;
}
export function amount(base: number, items: QuotationItem[]) {
  const value = items.reduce(
    (sum, item) =>
      sum + (item.direction === "add" ? item.amountMinor : -item.amountMinor),
    base,
  );
  return Number.isSafeInteger(value) &&
    value >= -2147483648 &&
    value <= 2147483647
    ? value
    : null;
}
export function basePrice(price: number) {
  const value = pesosToCentavos(price);
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647
    ? value
    : null;
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
    acceptedAt: iso(row.accepted_at),
    supersededAt: iso(row.superseded_at),
    offeredPackageId: row.offered_package_id,
    adjustmentsReviewed: row.adjustments_reviewed,
    previousQuotationId: row.previous_quotation_id,
    revisionReason: row.revision_reason,
    items: z.array(itemSchema).parse(row.items),
  };
}
export async function locked(trx: Transaction<DB>, id: string) {
  const found = await findQuoteData(trx, id);
  if (!found) return null;
  const booking = await lockBookingRequestData(trx, found.booking_request_id);
  if (!booking) return null;
  const row = await lockQuoteData(trx, id);
  return row ? { booking, row } : null;
}
export async function audit(
  trx: Transaction<DB>,
  actor: string,
  action: string,
  id: string,
  meta: Record<string, unknown>,
) {
  await createAuditEventData(trx, {
    actor_id: actor,
    action,
    entity_type: "quotation",
    entity_id: id,
    metadata: JSON.stringify(meta),
  });
}
export const closed = (booking: Booking) =>
  ["declined", "cancelled"].includes(booking.status);
