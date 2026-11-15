import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  claimGuestChatRequestSchema,
  claimGuestChatResponseSchema,
} from "./schemas.js";
import { json, errors, body } from "./http.js";
import { claimGuestChatService } from "../../services/ai-chat/claim-guest-chat.js";

export const claimGuestChatRoute = createRoute({
  method: "post",
  path: "/ai-chat/claim",
  tags: ["AI Chat"],
  summary: "Save a guest chat conversation after the visitor signs in",
  description:
    "Writes all guest turns into the signed-in customer's conversation. " +
    "User turns are stored as customer messages; AI turns are stored as " +
    "admin messages attributed to the AI sender. The conversation then " +
    "appears in the customer's Messages and in the admin inbox.",
  request: { body: body(claimGuestChatRequestSchema) },
  responses: {
    200: {
      content: json(claimGuestChatResponseSchema),
      description: "Turns saved",
    },
    400: errors[400],
    401: errors[401],
    403: errors[403],
  },
});

export const claimGuestChatRouteHandler: AppRouteHandler<
  typeof claimGuestChatRoute
> = async (c) => {
  const { turns } = c.req.valid("json");
  const customerId = c.get("session").user.id;

  const result = await claimGuestChatService(c.get("db"), customerId, turns);
  return c.json(result, 200);
};
