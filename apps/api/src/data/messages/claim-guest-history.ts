import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB> | Transaction<DB>;

export type GuestHistoryMessage = {
  role: "user" | "assistant";
  body: string;
  createdAt?: string;
};

export async function countConversationMessagesData(db: Database, conversationId: string) {
  const row = await db
    .selectFrom("messages")
    .select((eb) => eb.fn.count("id").as("count"))
    .where("conversation_id", "=", conversationId)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

// Import one browser guest thread into the customer's existing conversation.
// guest_chat_id makes a retried claim idempotent.
export async function claimGuestHistoryData(
  db: Database,
  conversation: ConversationWithCustomer,
  guestChatId: string,
  messages: GuestHistoryMessage[],
) {
  return db.transaction().execute(async (trx) => {
    const now = Date.now();
    if (messages.length) {
      // Preserve the guest order even when timestamps are missing or identical.
      let previous = 0;
      const rows = messages.map((message, index) => {
        const parsed = message.createdAt ? Date.parse(message.createdAt) : Number.NaN;
        let createdAt = Number.isFinite(parsed) && parsed <= now ? parsed : now + index;
        if (createdAt <= previous) createdAt = previous + 1;
        previous = createdAt;
        return {
          conversation_id: conversation.id,
          sender_id: message.role === "user" ? conversation.customer_id : null,
          sender_role: message.role === "user" ? "customer" : "assistant",
          body: message.body,
          created_at: new Date(createdAt),
          read_at: message.role === "assistant" ? new Date() : null,
        };
      });
      await trx.insertInto("messages").values(rows).execute();
    }
    const reopening = conversation.status === "closed";
    await trx
      .updateTable("conversations")
      .set({
        guest_chat_id: guestChatId,
        // Never undo a staff takeover or a pending staff request. Only an
        // expired conversation returns to the assistant.
        status: reopening ? "active" : conversation.status,
        closed_at: reopening ? null : conversation.closed_at,
        created_at: reopening ? new Date() : conversation.created_at,
        updated_at: new Date(),
        // A closed conversation may still point at an old event. Reopening it
        // for a fresh guest chat starts a clean cycle; history is preserved.
        ...(reopening
          ? {
              package_id: null,
              booking_request_id: null,
              event_type: null,
              event_starts_at: null,
              event_ends_at: null,
              guest_count: null,
            }
          : {}),
      })
      .where("id", "=", conversation.id)
      .execute();
    return countConversationMessagesData(trx, conversation.id);
  });
}
