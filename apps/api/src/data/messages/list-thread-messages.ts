import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectMessageColumnsData } from "./select-message-columns.js";

type Database = Kysely<DB>;

export async function listThreadMessagesData(db: Database, conversationId: string) {
  return selectMessageColumnsData(db, conversationId)
    .orderBy("m.created_at", "asc")
    .orderBy("m.id", "asc")
    .execute();
}
