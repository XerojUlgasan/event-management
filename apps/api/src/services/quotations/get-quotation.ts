import type { Kysely } from "kysely";
import { findQuotationBookingData } from "../../data/quotations/find-quotation-booking.js";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import type { DB } from "../../db/types.js";
import { customerDto, failure } from "./quotation-context.js";

export async function getQuotationService(
  db: Kysely<DB>,
  id: string,
  actor: string,
) {
  const row = await findQuoteData(db, id);

  if (!row || row.status === "draft" || !row.sent_at)
    return failure("Quotation not found", 404);

  const booking = await findQuotationBookingData(db, row.booking_request_id);

  if (!booking || booking.customer_id !== actor)
    return failure("Quotation not found", 404);

  return customerDto(row);
}
