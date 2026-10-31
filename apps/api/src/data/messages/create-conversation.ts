import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

export async function createConversationData(db: Kysely<DB>, customerId: string) {
  const row = await db
    .insertInto("conversations")
    .values({ customer_id: customerId })
    .returning("id")
    .executeTakeFirstOrThrow();
  return selectConversationColumnsData(db)
    .where("c.id", "=", row.id)
    .executeTakeFirstOrThrow();
}