import type { SaveAgentSettings } from "@event-management/contracts/ai-agent-settings";
import type { Kysely } from "kysely";
import { saveAgentSettingsData } from "../../data/ai-agent-settings/save-agent-settings.js";
import type { DB } from "../../db/types.js";
import { settingsResponse } from "./settings-response.js";

export async function saveAgentSettingsService(
  db: Kysely<DB>,
  input: SaveAgentSettings,
) {
  const row = await saveAgentSettingsData(db, input);

  return row ? settingsResponse(row) : null;
}
