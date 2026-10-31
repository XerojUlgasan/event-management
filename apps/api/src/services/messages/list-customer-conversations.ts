import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { countUnreadMessagesData } from "../../data/messages/count-unread-messages.js";
import { listLastMessagesData } from "../../data/messages/list-last-messages.js";
import { listCustomerConversationsData } from "../../data/messages/list-customer-conversations.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { conversationDto, messageDto } from "./message-response.js";

export async function listCustomerConversationsService(db: Kysely<DB>, customerId: string) {
  await expireConversationsData(db);
  const rows = await listCustomerConversationsData(db, customerId).execute();
  const ids = rows.map((row) => row.id);
  const [last, unread] = await Promise.all([
    listLastMessagesData(db, ids),
    countUnreadMessagesData(db, ids),
  ]);
  return rows.map((row) => {
    const latest = last.get(row.id);
    return conversationDto(row, latest ? messageDto(latest) : null, unread.get(row.id) ?? 0);
  });
}