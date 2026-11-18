import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { updateConversationAiService } from "../../services/messages/update-conversation-ai.js";
import { conversationAiSchema, updateConversationAiSchema } from "./schemas.js";
import { body, errors, idParams, json } from "./http.js";

export const updateConversationAiRoute = createRoute({
  method: "patch",
  path: "/admin/conversations/{id}/ai",
  tags: ["Messages"],
  summary: "Enable or disable automatic AI replies",
  request: { params: idParams, body: body(updateConversationAiSchema) },
  responses: {
    200: {
      content: json(conversationAiSchema),
      description: "AI preference saved",
    },
    ...errors,
  },
});

export const updateConversationAiRouteHandler: AppRouteHandler<
  typeof updateConversationAiRoute
> = async (c) => {
  const { aiEnabled, expectedAiVersion } = c.req.valid("json");
  const result = await updateConversationAiService(
    c.get("db"),
    c.req.valid("param").id,
    aiEnabled,
    expectedAiVersion,
  );
  if (result.kind === "ok")
    return c.json(
      {
        aiEnabled: result.aiEnabled,
        aiVersion: result.aiVersion,
        aiHandoff: result.aiHandoff,
      },
      200,
    );
  return jsonError(c, result.error, result.status);
};
