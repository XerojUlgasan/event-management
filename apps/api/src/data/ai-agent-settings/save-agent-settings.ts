import type { SaveAgentSettings } from "@event-management/contracts/ai-agent-settings";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function saveAgentSettingsData(
  db: Kysely<DB>,
  { settings, expectedRevision }: SaveAgentSettings,
) {
  return db
    .updateTable("ai_agent_settings")
    .set({
      display_name: settings.displayName,
      greeting: settings.greeting || null,
      personality: settings.personality,
      additional_instructions: settings.additionalInstructions,
      allow_business_information: settings.allowBusinessInformation,
      allow_public_catalog: settings.allowPublicCatalog,
      revision: (expression) => expression("revision", "+", 1),
      updated_at: sql<Date>`clock_timestamp()`,
    })
    .where("id", "=", 1)
    .where("revision", "=", expectedRevision)
    .returningAll()
    .executeTakeFirst();
}
