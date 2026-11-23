import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function getAgentSettingsData(db: Kysely<DB>) {
  return db
    .selectFrom("ai_agent_settings")
    .selectAll()
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
}
