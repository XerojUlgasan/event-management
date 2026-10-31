import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB> | Transaction<DB>;

export type GuestHistoryMessage = {
  role: "user" | "assistant";
  body: string;
  createdAt?: string;
};

export async function claimGuestHistoryData(
  db: Database,
  conversation: ConversationWithCustomer,
  messages: GuestHistoryMessage[],
) {
  return db.transaction().execute(async (trx) => {
    const now = Date.now();
    if (messages.length) {
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
    await trx
      .updateTable("conversations")
      .set({ updated_at: new Date() })
      .where("id", "=", conversation.id)
      .execute();
  });
}
