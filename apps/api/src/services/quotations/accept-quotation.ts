import type { Kysely } from "kysely";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import { updateQuotationData } from "../../data/quotations/update-quotation.js";
import type { DB } from "../../db/types.js";
import {
  audit,
  closed,
  dto,
  failure,
  locked,
} from "./quotation-context.js";

export async function acceptQuotationService(
  db: Kysely<DB>,
  id: string,
  actor: string,
  expected: string,
) {
  return db.transaction().execute(async (trx) => {
    const found = await locked(trx, id);
    if (!found || found.booking.customer_id !== actor)
      return failure("Quotation not found", 404);
    const { row, booking } = found;
    if (row.revision !== expected)
      return failure("Quotation changed. Refresh and try again", 409);
    if (closed(booking) || row.status !== "sent")
      return failure("Only an active sent quotation can be accepted", 409);
    await updateQuotationData(trx, id, {
      status: "accepted",
      accepted_at: new Date(),
    });
    await audit(trx, actor, "quotation.accepted", id, {
      bookingRequestId: booking.id,
    });
    return dto((await findQuoteData(trx, id))!);
  });
}
