import type { Kysely } from "kysely";
import { createQuotationMessageData } from "../../data/messages/create-quotation-message.js";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import {
  supersedeActiveQuotationsData,
  updateQuotationData,
} from "../../data/quotations/update-quotation.js";
import type { DB } from "../../db/types.js";
import { audit, closed, dto, failure, locked } from "./quotation-context.js";

export async function sendQuotationService(
  db: Kysely<DB>,
  id: string,
  actor: string,
  expected: string,
) {
  return db.transaction().execute(async (trx) => {
    const found = await locked(trx, id);

    if (!found) return failure("Quotation not found", 404);

    const { row, booking } = found;

    if (row.revision !== expected)
      return failure("Quotation changed. Refresh and try again", 409);

    if (closed(booking) || row.status !== "draft")
      return failure("Only an open draft can be sent", 409);

    if (!row.adjustments_reviewed)
      return failure("Review adjustments before sending", 409);

    if (row.total_amount_minor < 0)
      return failure("Quotation total cannot be negative", 400);

    const delivered = await createQuotationMessageData(
      trx,
      booking.id,
      actor,
      id,
    );

    if (!delivered) return failure("Linked conversation is closed", 409);

    const now = new Date();
    await supersedeActiveQuotationsData(trx, booking.id, now);
    await updateQuotationData(trx, id, { status: "sent", sent_at: now });
    await audit(trx, actor, "quotation.sent", id, {
      bookingRequestId: booking.id,
      version: row.version,
    });

    return dto((await findQuoteData(trx, id))!);
  });
}
