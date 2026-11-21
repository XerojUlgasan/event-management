import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { issueRealtimeTokenService } from "../../services/auth/issue-realtime-token.js";
import { errorSchema } from "./profile.js";

export const issueRealtimeTokenRoute = createRoute({
  method: "post",
  path: "/auth/realtime-token",
  tags: ["Auth"],
  summary: "Issue a short-lived receive-only Realtime token",
  request: {
    body: {
      required: true,
      content: openapiJson(
        z.union([
          z.strictObject({ conversationId: z.string().uuid() }),
          z.strictObject({ scope: z.literal("notifications") }),
        ]),
      ),
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
      description:
        "A token scoped to one conversation or the signed-in user's notifications",
    },
    400: {
      content: openapiJson(errorSchema),
      description: "Invalid Realtime token request",
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

export const issueRealtimeTokenRouteHandler: AppRouteHandler<
  typeof issueRealtimeTokenRoute
> = async (c) => {
  const result = await issueRealtimeTokenService(
    c.get("db"),
    c.get("session"),
    c.req.valid("json"),
  );

  if (result.kind === "not-found")
    return jsonError(c, "Conversation not found", 404);

  if (result.kind === "session-expired")
    return jsonError(c, "Session expired", 401);

  if (result.kind === "unavailable")
    return jsonError(c, "Realtime authorization is unavailable", 503);

  return c.json({ token: result.token, expiresAt: result.expiresAt }, 200);
};
