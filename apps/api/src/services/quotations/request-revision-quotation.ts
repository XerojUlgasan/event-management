import type { Kysely } from "kysely";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import type { DB } from "../../db/types.js";
import { audit, closed, dto, failure, locked } from "./quotation-context.js";

export async function requestRevisionQuotationService(
  db: Kysely<DB>,
  id: string,
  actor: string,
  expected: string,
) {
  return db.transaction().execute(async (trx) => {
    const found = await locked(trx, id);

    if (!found) return failure("Quotation not found", 404);

    const { row, booking } = found;

    if (booking.customer_id !== actor)
      return failure("Quotation not found", 404);

    if (row.revision !== expected)
      return failure("Quotation changed. Refresh and try again", 409);

    if (closed(booking) || row.status !== "sent")
      return failure("Only a sent quotation can have a revision requested", 409);

    const conversation = await trx
      .selectFrom("conversations")
      .select(["id", "status"])
      .where("booking_request_id", "=", booking.id)
      .executeTakeFirst();

    if (!conversation || conversation.status !== "active")
      return failure("Conversation is closed", 409);

    await trx
      .insertInto("messages")
      .values({
        conversation_id: conversation.id,
        sender_id: actor,
        sender_role: "customer",
        body: "I'd like to request a revision on this quotation.",
        read_at: null,
      })
      .execute();

    await trx
      .updateTable("conversations")
      .set({ updated_at: new Date() })
      .where("id", "=", conversation.id)
      .execute();

    await audit(trx, actor, "quotation.revision_requested", id, {
      bookingRequestId: booking.id,
      version: row.version,
    });

    return dto((await findQuoteData(trx, id))!);
  });
}
