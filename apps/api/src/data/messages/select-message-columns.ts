import { messageImagesSelection } from "./message-images.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export function selectMessageColumnsData(db: Database, conversationId: string) {
  return db
    .selectFrom("messages as m")
    .leftJoin("users as sender", "sender.id", "m.sender_id")
    .select((eb) => [
      messageImagesSelection(),
      "m.id",
      "m.guest_origin",
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
    .where("m.conversation_id", "=", conversationId);
}
