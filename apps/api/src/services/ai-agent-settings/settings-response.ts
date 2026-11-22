import {
  agentSettingsSchema,
  type AgentSettingsResponse,
} from "@event-management/contracts/ai-agent-settings";
import type { Selectable } from "kysely";
import type { AiAgentSettings } from "../../db/types.js";

export function settingsResponse(
  row: Selectable<AiAgentSettings>,
): AgentSettingsResponse {
  return {
    settings: agentSettingsSchema.parse({
      displayName: row.display_name,
      greeting: row.greeting,
      personality: row.personality,
      additionalInstructions: row.additional_instructions,
      allowBusinessInformation: row.allow_business_information,
      allowPublicCatalog: row.allow_public_catalog,
    }),
    revision: row.revision,
    updatedAt: row.updated_at.toISOString(),
  };
}
