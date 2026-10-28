import { z } from "@hono/zod-openapi";

export const messageBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending")
    .max(4000, "Messages can be at most 4000 characters"),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  senderId: z.string().uuid(),
  senderRole: z.enum(["admin", "customer"]),
  senderName: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const conversationSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string(),
  lastMessage: messageSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const threadSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema),
});

export const conversationsSchema = z.object({
  conversations: z.array(conversationSchema),
});

export const messageResultSchema = z.object({
  message: messageSchema,
});

export const errorSchema = z.object({ error: z.string() });
