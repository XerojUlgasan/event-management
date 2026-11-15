import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { AI_SENDER_ID } from "./chat-service.js";

export type GuestTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ClaimGuestChatResult = {
  conversationId: string;
  savedCount: number;
};

/**
 * Persists a guest (unauthenticated) chat history into the signed-in
 * customer's conversation after they log in or register.
 *
 * - Creates or reuses the customer's most recent general conversation.
 * - Writes each guest turn as a message: user turns as "customer" sender,
 *   assistant turns as "admin" sender attributed to AI_SENDER_ID.
 * - All inserts run in a single transaction. The conversation's updated_at
 *   is advanced to each message's created_at in order.
 * - Skips empty turns. Returns the conversation ID and how many were saved.
 */
export async function claimGuestChatService(
  db: Kysely<DB>,
  customerId: string,
  turns: GuestTurn[],
): Promise<ClaimGuestChatResult> {
  const validTurns = turns.filter((t) => t.content.trim().length > 0);

  // Even with no valid turns, ensure a conversation exists and return it.
  if (validTurns.length === 0) {
    const conversation = await ensureConversationData(db, customerId);
    return { conversationId: conversation.id, savedCount: 0 };
  }

  const conversation = await ensureConversationData(db, customerId);

  await db.transaction().execute(async (trx) => {
    for (const turn of validTurns) {
      const senderId = turn.role === "user" ? customerId : AI_SENDER_ID;
      const senderRole = turn.role === "user" ? "customer" : "admin";

      const row = await trx
        .insertInto("messages")
        .values({
          conversation_id: conversation.id,
          sender_id: senderId,
          sender_role: senderRole,
          body: turn.content.trim(),
          read_at: null,
        })
        .returning("created_at")
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("conversations")
        .set({ updated_at: row.created_at })
        .where("id", "=", conversation.id)
        .execute();
    }
  });

  return { conversationId: conversation.id, savedCount: validTurns.length };
}
