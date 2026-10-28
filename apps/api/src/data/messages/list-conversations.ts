import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

type Database = Kysely<DB>;

export async function listConversationsData(db: Database) {
  return selectConversationColumnsData(db)
    .where(({ exists, selectFrom }) =>
      exists(
        selectFrom("messages as m")
          .select("m.id")
          .whereRef("m.conversation_id", "=", "c.id"),
      ),
    )
    .orderBy("c.updated_at", "desc")
    .execute();
}
