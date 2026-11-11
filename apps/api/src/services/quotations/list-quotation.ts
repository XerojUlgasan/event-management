import type { Kysely } from "kysely";
import { findQuotationBookingData } from "../../data/quotations/find-quotation-booking.js";
import { listQuotesData } from "../../data/quotations/list-quotations.js";
import type { DB } from "../../db/types.js";
import { dto, failure } from "./quotation-context.js";

export async function listQuotationService(
  db: Kysely<DB>,
  bookingId: string,
  actor: string,
  customer: boolean,
) {
  const booking = await findQuotationBookingData(db, bookingId);
  if (!booking || (customer && booking.customer_id !== actor))
    return failure("Booking request not found", 404);
  const rows = await listQuotesData(db, bookingId);
  return rows
    .filter((q) => !customer || (q.status !== "draft" && q.sent_at !== null))
    .map(dto);
}
