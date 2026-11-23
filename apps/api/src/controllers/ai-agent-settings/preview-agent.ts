import {
  agentPreviewResponseSchema,
  agentPreviewSchema,
} from "@event-management/contracts/ai-agent-settings";
import { createRoute } from "@hono/zod-openapi";
import { previewAgentService } from "../../services/ai-agent-settings/preview-agent.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { adminErrors, errorResponse, invalidRequest, tags } from "./http.js";

export const previewAgentRoute = createRoute({
  method: "post",
  path: "/admin/ai/agent-settings/preview",
  tags,
  request: {
    body: { required: true, content: openapiJson(agentPreviewSchema) },
  },
  responses: {
    200: {
      description: "Isolated test reply",
      content: openapiJson(agentPreviewResponseSchema),
    },
    400: invalidRequest,
    503: errorResponse("Test reply is unavailable"),
    ...adminErrors,
  },
});

export const previewAgentRouteHandler: AppRouteHandler<
  typeof previewAgentRoute
> = async (c) => {
  const result = await previewAgentService(
    c.req.valid("json"),
    c.req.raw.signal,
  );

  return result
    ? c.json(result, 200)
    : c.json(
        { error: "The test reply could not be generated. Try again." },
        503,
      );
};
