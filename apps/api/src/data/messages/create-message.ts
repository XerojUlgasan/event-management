import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB>;

export async function createMessageData(
  db: Database,
  conversation: ConversationWithCustomer,
  senderId: string | null,
  senderRole: "customer" | "admin" | "assistant" | "system",
  body: string,
  conversationStatus?: "staff",
  senderName?: string,
) {
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .insertInto("messages")
      .values({
        conversation_id: conversation.id,
        sender_id: senderId,
        sender_role: senderRole,
        body,
        read_at: senderRole === "assistant" || senderRole === "system" ? new Date() : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("conversations")
      .set({
        updated_at: row.created_at,
        ...(conversationStatus ? { status: conversationStatus, closed_at: null } : {}),
      })
      .where("id", "=", conversation.id)
      .execute();
    if (!senderId) {
      return {
        ...row,
        sender_display_name: senderName ?? (senderRole === "system" ? "Clemora" : "Clemora assistant"),
        sender_email: null,
      };
    }
    const sender = await trx
      .selectFrom("users")
      .select(["display_name", "email"])
      .where("id", "=", senderId)
      .executeTakeFirstOrThrow();
    return {
      ...row,
      sender_display_name: sender.display_name,
      sender_email: sender.email,
    };
  });
}
