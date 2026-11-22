import type {
  AgentProfile,
  AgentPreviewMessage,
  AgentPreviewResponse,
  AgentSettings,
  AgentSettingsResponse,
} from "@event-management/contracts/ai-agent-settings";
import { request } from "../../http/request";

export const getAgentSettings = () =>
  request<AgentSettingsResponse>("/admin/ai/agent-settings");

export const publishAgentSettings = (
  settings: AgentSettings,
  expectedRevision: AgentSettingsResponse["revision"],
) =>
  request<AgentSettingsResponse>(
    "/admin/ai/agent-settings",
    { settings, expectedRevision },
    undefined,
    "PUT",
  );

export const previewAgent = (
  settings: AgentSettings,
  messages: AgentPreviewMessage[],
) =>
  request<AgentPreviewResponse>("/admin/ai/agent-settings/preview", {
    settings,
    messages,
  });

export const getAgentProfile = () => request<AgentProfile>("/ai/agent-profile");
