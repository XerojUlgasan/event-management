import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { publishConversationMessageData } from "./publish-conversation-message.js";

// Caller holds the booking lock; lock the conversation during delivery.
export async function createQuotationMessageData(
  trx: Transaction<DB>,
  bookingId: string,
  senderId: string,
  quotationId: string,
) {
  const conversation = await trx
    .selectFrom("conversations")
    .select(["id", "customer_id"])
    .where("booking_request_id", "=", bookingId)
    .forUpdate()
    .executeTakeFirst();

  if (!conversation) return undefined;

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
    .returning(["id", "created_at"])
    .executeTakeFirstOrThrow();
  await trx
    .updateTable("conversations")
    .set({ updated_at: message.created_at })
    .where("id", "=", conversation.id)
    .execute();

  if (conversation.customer_id)
    await publishConversationMessageData(trx, conversation.id, message.id);

  return conversation.id;
}
