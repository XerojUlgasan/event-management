import { sql, type Kysely } from "kysely";
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
    .orderBy(
      sql`case when c.status = 'waiting_staff' then 0 when c.status = 'active' then 1 when c.status = 'staff' then 2 else 3 end`,
    )
    .orderBy("c.updated_at", "desc")
    .execute();
}
