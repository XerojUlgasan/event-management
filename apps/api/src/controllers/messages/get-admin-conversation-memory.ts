import { createRoute, z } from "@hono/zod-openapi";
import { readBookingConversationMemoryData } from "../../data/messages/conversation-memory.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { errors, idParams, json } from "./http.js";

export const getAdminConversationMemoryRoute = createRoute({
  method: "get",
  path: "/admin/conversations/{id}/memory",
  tags: ["Messages"],
  summary: "Read the AI notes for a submitted booking conversation as an admin",
  request: { params: idParams },
  responses: {
    200: {
      content: json(z.object({ markdown: z.string().nullable() })),
      description: "The saved AI notes, if available",
    },
    400: errors[400],
    401: errors[401],
    403: errors[403],
    404: errors[404],
  },
});

export const getAdminConversationMemoryRouteHandler: AppRouteHandler<
  typeof getAdminConversationMemoryRoute
> = async (c) => {
  const memory = await readBookingConversationMemoryData(
    c.get("db"),
    c.req.valid("param").id,
  );

  return memory
    ? c.json(memory, 200)
    : jsonError(c, "Conversation not found", 404);
};
