import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import { z } from "@hono/zod-openapi";

export const messageBodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending")
    .max(
      MAX_MESSAGE_BODY_LENGTH,
      `Messages can be at most ${MAX_MESSAGE_BODY_LENGTH} characters`,
    ),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  quotationId: z.string().uuid().nullable(),
  senderId: z.string().uuid(),
  senderRole: z.enum(["admin", "customer"]),
  senderName: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const conversationStatusSchema = z.enum(["active", "closed"]);

export const conversationSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string(),
  packageId: z.string().uuid().nullable(),
  packageName: z.string().nullable(),
  bookingRequestId: z.string().uuid().nullable(),
  bookingRequestReference: z.string().nullable(),
  eventType: z.string().nullable(),
  eventStartsAt: z.string().nullable(),
  eventEndsAt: z.string().nullable(),
  guestCount: z.number().int().positive().nullable(),
  status: conversationStatusSchema,
  closedAt: z.string().nullable(),
  lastMessage: messageSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const threadSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema),
  nextCursor: z.string().nullable(),
});

export const conversationsSchema = z.object({
  conversations: z.array(conversationSchema),
  nextCursor: z.string().nullable(),
});

export const adminConversationsPageSchema = conversationsSchema.extend({
  nextCursor: z.string().nullable(),
});

export const messageResultSchema = z.object({
  message: messageSchema,
});

export const errorSchema = z.object({ error: z.string() });
