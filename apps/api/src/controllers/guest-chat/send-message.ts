import { createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { AppRouteHandler } from "../../types/hono.js";
import { GUEST_COOKIE } from "../../utils/guest-chat.js";
import { errors, statusSchema } from "./schemas.js";
import { body, idParams, json } from "../messages/http.js";
import { sendGuestMessageService } from "../../services/guest-chat/send-message.js";
import {
  customerMessageResultSchema,
  messageBodySchema,
} from "../messages/schemas.js";

export const sendGuestMessageRoute = createRoute({
  method: "post",
  path: "/guest/conversations/{id}/messages",
  tags: ["Guest chat"],
  summary: "Send one deduplicated anonymous customer message",
  request: {
    params: idParams,
    body: body(
      z
        .object({
          body: messageBodySchema.shape.body,
          requestId: z.string().uuid(),
        })
        .strict(),
    ),
  },
  responses: {
    201: {
      content: json(
        customerMessageResultSchema.extend({ guest: statusSchema }),
      ),
      description: "Saved guest turn (including replays)",
    },
    ...errors,
  },
});

export const sendGuestMessageRouteHandler: AppRouteHandler<
  typeof sendGuestMessageRoute
> = async (c) => {
  const { body, requestId } = c.req.valid("json");

  return c.json(
    await sendGuestMessageService(
      c.get("db"),
      c.req.valid("param").id,
      getCookie(c, GUEST_COOKIE),
      body,
      requestId,
      c.req.raw.signal,
    ),
    201,
  );
};
