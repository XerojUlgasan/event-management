import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

// Caller holds the booking lock. Check conversation status under a lock in the delivery transaction.
export async function createQuotationMessageData(
  trx: Transaction<DB>,
  bookingId: string,
  senderId: string,
  quotationId: string,
) {
  const conversation = await trx
    .selectFrom("conversations")
    .selectAll()
    .where("booking_request_id", "=", bookingId)
    .forUpdate()
    .executeTakeFirst();
  if (!conversation || conversation.status !== "active") return false;
  const message = await trx
    .insertInto("messages")
    .values({
      conversation_id: conversation.id,
      sender_id: senderId,
      sender_role: "admin",
      body: "A quotation is ready for your review.",
      quotation_id: quotationId,
      read_at: null,
    })
    .returning("created_at")
    .executeTakeFirstOrThrow();
  await trx
    .updateTable("conversations")
    .set({ updated_at: message.created_at })
    .where("id", "=", conversation.id)
    .execute();
  return true;
}
