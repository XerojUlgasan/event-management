import { createRoute } from "@hono/zod-openapi";
import { getAgentSettingsService } from "../../services/ai-agent-settings/get-agent-settings.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { adminErrors, readSettings, tags } from "./http.js";

export const getAgentSettingsRoute = createRoute({
  method: "get",
  path: "/admin/ai/agent-settings",
  tags,
  responses: { 200: readSettings, ...adminErrors },
});

export const getAgentSettingsRouteHandler: AppRouteHandler<
  typeof getAgentSettingsRoute
> = async (c) => c.json(await getAgentSettingsService(c.get("db")), 200);
