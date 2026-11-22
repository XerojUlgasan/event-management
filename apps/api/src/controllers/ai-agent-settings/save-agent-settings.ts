import { saveAgentSettingsSchema } from "@event-management/contracts/ai-agent-settings";
import { createRoute } from "@hono/zod-openapi";
import { saveAgentSettingsService } from "../../services/ai-agent-settings/save-agent-settings.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import {
  adminErrors,
  errorResponse,
  invalidRequest,
  readSettings,
  tags,
} from "./http.js";

export const saveAgentSettingsRoute = createRoute({
  method: "put",
  path: "/admin/ai/agent-settings",
  tags,
  request: {
    body: { required: true, content: openapiJson(saveAgentSettingsSchema) },
  },
  responses: {
    200: readSettings,
    400: invalidRequest,
    409: errorResponse("Settings changed since they were opened"),
    ...adminErrors,
  },
});

export const saveAgentSettingsRouteHandler: AppRouteHandler<
  typeof saveAgentSettingsRoute
> = async (c) => {
  const saved = await saveAgentSettingsService(
    c.get("db"),
    c.req.valid("json"),
  );

  return saved
    ? c.json(saved, 200)
    : c.json(
        {
          error:
            "Someone published newer settings. Review them before publishing again.",
        },
        409,
      );
};
