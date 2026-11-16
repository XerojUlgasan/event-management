import { z } from "@hono/zod-openapi";
import { threadSchema } from "../messages/schemas.js";
import { json } from "../messages/http.js";

export const statusSchema = z.object({
  customerMessageCount: z.number().int().nonnegative(),
  remainingMessages: z.number().int().nonnegative(),
  expiresAt: z.string(),
  loginRequired: z.boolean(),
});
export const guestThreadSchema = threadSchema.extend({ guest: statusSchema });
const guestErrorSchema = z.object({
  error: z.string(),
  code: z
    .enum(["login_required", "guest_expired", "request_conflict"])
    .optional(),
});
export const errors = {
  400: { content: json(guestErrorSchema), description: "Invalid request" },
  401: { content: json(guestErrorSchema), description: "Not signed in" },
  403: {
    content: json(guestErrorSchema),
    description: "Customer access required",
  },
  404: {
    content: json(guestErrorSchema),
    description: "Conversation not found",
  },
  409: {
    content: json(guestErrorSchema),
    description: "Sign in required or request conflict",
  },
  410: {
    content: json(guestErrorSchema),
    description: "Guest conversation expired",
  },
};
