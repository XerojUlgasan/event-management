import { messageProcessingSelection } from "./message-processing.js";
import { messageImagesSelection } from "./message-images.js";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export const handoffAcknowledgementSelection = sql<boolean>`exists (
  select 1 from ai_tool_calls as handoff
  where handoff.assistant_message_id = m.id
    and handoff.tool_name = 'requestHumanHandoff'
    and handoff.status = 'succeeded'
)`.as("handoff_acknowledgement");

export function selectMessageColumnsData(db: Database, conversationId: string) {
  return db
    .selectFrom("messages as m")
    .leftJoin("users as sender", "sender.id", "m.sender_id")
    .select((eb) => [
      messageImagesSelection(),
      messageProcessingSelection(),
      handoffAcknowledgementSelection,
      "m.id",
      "m.guest_origin",
      "m.reply_to_message_id",
      "m.conversation_id",
      "m.sender_id",
      "m.sender_role",
      "m.body",
      "m.quotation_id",
      "m.catalog_recommendations",
      "m.suggested_replies",
      "m.created_at",
      "m.read_at",
      eb.ref("sender.display_name").as("sender_display_name"),
      eb.ref("sender.email").as("sender_email"),
    ])
    .where("m.conversation_id", "=", conversationId);
}
