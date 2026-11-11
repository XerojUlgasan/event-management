import type { Kysely } from "kysely";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { createQuotationData } from "../../data/quotations/create-quotation.js";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import { listQuotesData } from "../../data/quotations/list-quotations.js";
import type { DB } from "../../db/types.js";
import {
  audit,
  basePrice,
  proposalPackage,
  closed,
  dto,
  failure,
} from "./quotation-context.js";

export async function createQuotationService(
  db: Kysely<DB>,
  bookingId: string,
  actor: string,
  expected: string,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);
    if (!booking) return failure("Booking request not found", 404);
    if (booking.revision !== expected)
      return failure("Booking request changed. Refresh and try again", 409);
    if (closed(booking)) return failure("This request is closed", 409);
    const pkg = await proposalPackage(trx, booking);
    const base = basePrice(pkg.price);
    if (base === null)
      return failure("Package price is outside the supported range", 400);
    const existing = await listQuotesData(trx, booking.id);
    if (existing.some((q) => ["draft", "sent", "accepted"].includes(q.status)))
      return failure("Revise the active quotation instead", 409);
    const row = await createQuotationData(trx, {
      booking_request_id: booking.id,
      version: (existing[0]?.version ?? 0) + 1,
      currency: "PHP",
      base_amount_minor: base,
      total_amount_minor: base,
      status: "draft",
      created_by: actor,
      offered_package_id: pkg.id,
      items: JSON.stringify([]),
      adjustments_reviewed: true,
      previous_quotation_id: null,
      revision_reason: null,
    });
    await audit(trx, actor, "quotation.created", row.id, {
      bookingRequestId: booking.id,
    });
    return dto((await findQuoteData(trx, row.id))!);
  });
}
