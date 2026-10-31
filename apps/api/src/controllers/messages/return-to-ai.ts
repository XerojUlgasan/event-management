import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { errors, idParams, json } from "./http.js";
import { returnToAiService } from "../../services/messages/return-to-ai.js";

export const returnToAiRoute = createRoute({
  method: "post",
  path: "/admin/conversations/{id}/return-to-ai",
  tags: ["Messages"],
  summary: "Return a staff-handled conversation to the assistant",
  request: { params: idParams },
  responses: {
    200: { content: json(threadSchema), description: "Conversation returned to the assistant" },
    ...errors,
  },
});

export const returnToAiRouteHandler: AppRouteHandler<typeof returnToAiRoute> = async (c) => {
  const result = await returnToAiService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
  );
  if (result.kind === "ok") return c.json(result.thread, 200);
  return result.kind === "closed"
    ? c.json({ error: "Conversation is closed" }, 409)
    : c.json({ error: "Conversation not found" }, 404);
};