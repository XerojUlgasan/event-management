import type {
  QuotationItem,
  QuotationPreparation,
} from "@event-management/contracts/quotations";
import type { Kysely } from "kysely";
import { resolveBookingPackageData } from "../../data/booking-requests/resolve-booking-package.js";
import { findQuotationBookingData } from "../../data/quotations/find-quotation-booking.js";
import { latestDeliveredQuoteData } from "../../data/quotations/list-quotations.js";
import type { DB } from "../../db/types.js";
import { quotationAddons } from "./quotation-addons.js";
import {
  basePrice,
  closed,
  failure,
  quotationItems,
} from "./quotation-context.js";

export async function prepareQuotationService(
  db: Kysely<DB>,
  bookingId: string,
) {
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .setAccessMode("read only")
    .execute(async (trx) => {
      const booking = await findQuotationBookingData(trx, bookingId);

      if (!booking) return failure("Booking request not found", 404);

      if (closed(booking)) return failure("This request is closed", 409);

      const pkg = await resolveBookingPackageData(trx, booking);

      if (!pkg)
        return failure(
          "Choose or create a package before preparing a quotation",
          409,
        );

      if (pkg.archived_at)
        return failure(
          "Choose an available package before preparing a quotation",
          409,
        );

      const base = basePrice(pkg.price);

      if (base === null)
        return failure("Package price is outside the supported range", 400);

      const offer = await latestDeliveredQuoteData(trx, booking.id);
      const previousItems = offer ? quotationItems(offer.items) : [];
      const addons = await quotationAddons(trx, pkg, false, previousItems);

      const addonIds = new Set(addons.map((item) => item.id));

      // Historical service-linked manual lines cannot become new service charges.
      const items: QuotationItem[] = [
        ...addons,
        ...previousItems.filter(
          (item) =>
            !item.addon &&
            !item.serviceId &&
            !addonIds.has(item.id.toLowerCase()),
        ),
      ];

      return {
        bookingRequestId: booking.id,
        expectedBookingUpdatedAt: booking.revision,
        packageId: pkg.id,
        expectedPackageUpdatedAt: pkg.updated_at.toISOString(),
        currentOffer: offer
          ? { id: offer.id, updatedAt: offer.revision }
          : null,
        baseAmountMinor: base,
        items,
      } satisfies QuotationPreparation;
    });
}
