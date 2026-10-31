import { z } from "@hono/zod-openapi";
import { conversationContextSchema } from "../messages/schemas.js";

const guestMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  body: z.string().trim().min(1).max(4000),
});

export const guestReplyRequestSchema = z
  .object({
    messages: z.array(guestMessageSchema).min(1).max(30),
    context: conversationContextSchema.optional(),
  })
  .refine((value) => value.messages.at(-1)?.role === "user", {
    message: "The last message must be from the visitor",
    path: ["messages"],
  });

export const guestReplyResponseSchema = z.object({ reply: z.string() });
export const chatbotErrorSchema = z.object({ error: z.string() });
