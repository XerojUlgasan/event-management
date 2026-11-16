import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function createAssistantMessageData(
  db: Kysely<DB>,
  conversationId: string,
  customerId: string,
  body: string,
  aiVersion: number,
) {
  return db.transaction().execute(async (trx) => {
    const conversation = await trx
      .selectFrom("conversations")
      .select(["id", "status", "ai_enabled", "ai_version"])
      .where("id", "=", conversationId)
      .where("customer_id", "=", customerId)
      .forUpdate()
      .executeTakeFirst();
    if (!conversation || conversation.status !== "active")
      throw new Error("Conversation is unavailable");
    if (!conversation.ai_enabled || conversation.ai_version !== aiVersion)
      return null;
    const message = await trx
      .insertInto("messages")
      .values({
        conversation_id: conversationId,
        sender_id: null,
        sender_role: "assistant",
        body,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("conversations")
      .set({ updated_at: message.created_at })
      .where("id", "=", conversationId)
      .execute();
    return { ...message, sender_display_name: null, sender_email: null };
  });
}
