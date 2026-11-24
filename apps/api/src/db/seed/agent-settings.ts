import { sql } from "kysely";
import type { SeedDb } from "./context.js";

const additionalInstructions = [
  "Open each new conversation with a brief, warm welcome in the configured tone. Default to English when the customer has not established a language. When they clearly use or request another language, match it, including mixed language. Keep their established language when a message gives no clear language signal.",
  "Review the tools available for this turn and what each can do before choosing which to call. Follow their descriptions, scopes, and lookup settings. For broad package or service browsing without criteria, use attachCatalogBrowse for the requested categories. For a tailored shortlist, verify current public options and use attachCatalogRecommendations when appropriate.",
  "Make as many relevant tool calls as needed within the turn's limits, including follow-up reads that can close meaningful gaps. Follow the existing booking review and consent rules. Report only verified facts and outcomes confirmed by the server or successful tools.",
].join("\n\n");

export async function seedAgentSettings(db: SeedDb) {
  await db
    .insertInto("ai_agent_settings")
    .values({ id: 1, additional_instructions: additionalInstructions })
    .onConflict((conflict) =>
      conflict
        .column("id")
        .doUpdateSet((expression) => ({
          additional_instructions: additionalInstructions,
          revision: expression("ai_agent_settings.revision", "+", 1),
          updated_at: sql<Date>`clock_timestamp()`,
        }))
        // The migration starts at revision 1. Publishing always advances it.
        .where("ai_agent_settings.revision", "=", 1)
        .where("ai_agent_settings.additional_instructions", "=", ""),
    )
    .execute();
}
