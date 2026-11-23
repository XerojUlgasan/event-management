import type { Kysely } from "kysely";
import { getAgentSettingsData } from "../../data/ai-agent-settings/get-agent-settings.js";
import type { DB } from "../../db/types.js";
import { settingsResponse } from "./settings-response.js";

export async function getAgentSettingsService(db: Kysely<DB>) {
  return settingsResponse(await getAgentSettingsData(db));
}
