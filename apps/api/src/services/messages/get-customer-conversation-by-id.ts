import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { getConversationThreadService } from "./get-conversation-thread.js";

export async function getCustomerConversationByIdService(
  db: Kysely<DB>,
  customerId: string,
  id: string,
  limit?: number,
  cursor?: string,
) {
  const conversation = await findConversationData(db, id);

  if (!conversation || conversation.customer_id !== customerId) return null;

  return getConversationThreadService(
    db,
    conversation,
    "customer",
    limit,
    cursor,
  );
}
