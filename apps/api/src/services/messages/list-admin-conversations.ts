import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listLastMessagesData } from "../../data/messages/list-last-messages.js";
import { listConversationsData } from "../../data/messages/list-conversations.js";
import { countUnreadMessagesData } from "../../data/messages/count-unread-messages.js";

import { messageDto, conversationDto } from "./message-response.js";

export async function listAdminConversationsService(db: Kysely<DB>) {
  const rows = await listConversationsData(db);
  const ids = rows.map((row) => row.id);
  const [last, unread] = await Promise.all([listLastMessagesData(db, ids), countUnreadMessagesData(db, ids)]);
  return rows.map((row) => {
    const latest = last.get(row.id);
    return conversationDto(row, latest ? messageDto(latest, row.customer_id) : null, unread.get(row.id) ?? 0);
  });
}
