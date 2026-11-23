import { agentProfileSchema } from "@event-management/contracts/ai-agent-settings";
import { createRoute } from "@hono/zod-openapi";
import { getAgentSettingsService } from "../../services/ai-agent-settings/get-agent-settings.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { tags } from "./http.js";

export const getAgentProfileRoute = createRoute({
  method: "get",
  path: "/ai/agent-profile",
  tags,
  responses: {
    200: {
      description: "Public assistant identity",
      content: openapiJson(agentProfileSchema),
    },
  },
});

export const getAgentProfileRouteHandler: AppRouteHandler<
  typeof getAgentProfileRoute
> = async (c) => {
  const {
    settings: { displayName, greeting },
  } = await getAgentSettingsService(c.get("db"));

  return c.json({ displayName, greeting }, 200);
};
