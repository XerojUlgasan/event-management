import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

type Database = Kysely<DB>;

export async function ensureConversationData(db: Database, customerId: string) {
  await db
    .insertInto("conversations")
    .values({ customer_id: customerId })
    .onConflict((conflict) => conflict.column("customer_id").doNothing())
    .execute();
  return selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .executeTakeFirstOrThrow();
}
