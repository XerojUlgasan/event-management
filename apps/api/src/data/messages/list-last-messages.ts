import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { MessageWithSender } from "./types.js";

type Database = Kysely<DB>;

export async function listLastMessagesData(db: Database, conversationIds: string[]) {
  if (!conversationIds.length) return new Map<string, MessageWithSender>();
  const rows = await db
    .selectFrom("messages as m")
    .leftJoin("users as sender", "sender.id", "m.sender_id")
    .select((eb) => [
      "m.id",
      "m.conversation_id",
      "m.sender_id",
      "m.sender_role",
      "m.body",
      "m.quotation_id",
      "m.created_at",
      "m.read_at",
      eb.ref("sender.display_name").as("sender_display_name"),
      eb.ref("sender.email").as("sender_email"),
    ])
    .distinctOn("m.conversation_id")
    .where("m.conversation_id", "in", conversationIds)
    .orderBy("m.conversation_id")
    .orderBy("m.created_at", "desc")
    .orderBy("m.id", "desc")
    .execute();
  return new Map(rows.map((row) => [row.conversation_id, row]));
}
