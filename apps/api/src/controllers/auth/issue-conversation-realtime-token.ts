import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { issueConversationRealtimeTokenService } from "../../services/auth/issue-conversation-realtime-token.js";
import { errorSchema } from "./profile.js";

export const issueConversationRealtimeTokenRoute = createRoute({
  method: "post",
  path: "/auth/realtime-token",
  tags: ["Auth"],
  summary: "Issue a short-lived receive-only token for a conversation",
  request: {
    body: {
      required: true,
      content: openapiJson(z.object({ conversationId: z.string().uuid() })),
    },
  },
  responses: {
    200: {
      content: openapiJson(
        z.object({
          token: z.string(),
          expiresAt: z.iso.datetime(),
        }),
      ),
      description: "Conversation Realtime token",
    },
    400: {
      content: openapiJson(errorSchema),
      description: "Invalid conversation ID",
    },
    401: {
      content: openapiJson(errorSchema),
      description: "Missing, invalid, or expired session",
    },
    404: {
      content: openapiJson(errorSchema),
      description: "Conversation not found",
    },
    503: {
      content: openapiJson(errorSchema),
      description: "Realtime token signing is unavailable",
    },
  },
});

export const issueConversationRealtimeTokenRouteHandler: AppRouteHandler<
  typeof issueConversationRealtimeTokenRoute
> = async (c) => {
  const result = await issueConversationRealtimeTokenService(
    c.get("db"),
    c.get("session"),
    c.req.valid("json").conversationId,
  );

  if (result.kind === "not-found")
    return jsonError(c, "Conversation not found", 404);

  if (result.kind === "session-expired")
    return jsonError(c, "Session expired", 401);

  if (result.kind === "unavailable")
    return jsonError(c, "Realtime authorization is unavailable", 503);

  return c.json({ token: result.token, expiresAt: result.expiresAt }, 200);
};
