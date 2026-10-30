import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { conversationContextSchema, threadSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";
import { updateConversationContextService } from "../../services/messages/update-conversation-context.js";

export const updateConversationContextRoute = createRoute({
  method: "patch",
  path: "/messages/conversation/context",
  tags: ["Messages"],
  summary: "Update the package, event requirements, or event schedule for the conversation",
  request: { body: body(conversationContextSchema) },
  responses: {
    200: { content: json(threadSchema), description: "Updated conversation" },
    400: errors[400],
    401: errors[401],
    403: errors[403],
  },
});
export const updateConversationContextRouteHandler: AppRouteHandler<typeof updateConversationContextRoute> = async (c) => {
  const result = await updateConversationContextService(
    c.get("db"),
    c.get("session").user.id,
    c.req.valid("json"),
  );
  if (result.kind === "ok") return c.json(result.thread, 200);
  return c.json(
    {
      error:
        result.kind === "invalid-package"
          ? "Package not found"
          : "Event end must be after the event start",
    },
    400,
  );
};
