import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

export function listCustomerConversationsData(db: Kysely<DB>, customerId: string) {
  return selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .orderBy("c.updated_at", "desc");
}