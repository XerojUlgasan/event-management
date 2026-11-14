import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function getCustomerConversationService(
  db: Kysely<DB>,
  customerId: string,
  limit?: number,
  cursor?: string,
) {
  return getConversationThreadService(
    db,
    await ensureConversationData(db, customerId),
    "customer",
    limit,
    cursor,
  );
}
