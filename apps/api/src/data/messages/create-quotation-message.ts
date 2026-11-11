import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { conversationExpiresAt } from "../../utils/conversation-expiry.js";

// Caller holds the booking lock. Lock the conversation and check expiry in the same transaction as delivery.
export async function createQuotationMessageData(
  trx: Transaction<DB>,
  bookingId: string,
  senderId: string,
  quotationId: string,
  eventEndsAt: Date | null,
) {
  const conversation = await trx
    .selectFrom("conversations")
    .selectAll()
    .where("booking_request_id", "=", bookingId)
    .forUpdate()
    .executeTakeFirst();
  if (
    !conversation ||
    conversation.status !== "active" ||
    conversationExpiresAt(eventEndsAt, conversation.created_at).getTime() <=
      Date.now()
  )
    return false;
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
