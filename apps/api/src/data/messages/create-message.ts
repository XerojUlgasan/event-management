import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB>;

export async function createMessageData(
  db: Database,
  conversation: ConversationWithCustomer,
  senderId: string,
  senderRole: "customer" | "admin",
  body: string,
) {
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .insertInto("messages")
      .values({
        conversation_id: conversation.id,
        sender_id: senderId,
        sender_role: senderRole,
        body,
        read_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("conversations")
      .set({
        updated_at: row.created_at,
      })
      .where("id", "=", conversation.id)
      .execute();
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
