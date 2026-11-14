import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

type Database = Kysely<DB>;

export async function findConversationData(db: Database, id: string) {
  return selectConversationColumnsData(db)
    .where("c.id", "=", id)
    .executeTakeFirst();
}
