import { chatMessageSchema } from "@event-management/contracts/messages";
import { aiHandoffSchema } from "@event-management/contracts/ai-handoff";
import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import { z } from "@hono/zod-openapi";

export const messageBodySchema = z.object({
  requestId: z.string().uuid().optional(),
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

export const customerMessageBodySchema = messageBodySchema.extend({
  requestId: z.string().uuid().optional(),
});

export const messageSchema = chatMessageSchema;

export const conversationSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  packageId: z.string().uuid().nullable(),
  packageName: z.string().nullable(),
  bookingRequestId: z.string().uuid().nullable(),
  bookingRequestReference: z.string().nullable(),
  eventType: z.string().nullable(),
  eventStartsAt: z.string().nullable(),
  eventEndsAt: z.string().nullable(),
  guestCount: z.number().int().positive().nullable(),
  aiEnabled: z.boolean(),
  aiVersion: z.number().int().nonnegative(),
  aiReplyPending: z.boolean(),
  aiHandoff: aiHandoffSchema.nullable().optional(),
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

export const conversationAiSchema = z.object({
  aiHandoff: aiHandoffSchema.nullable(),
  aiEnabled: z.boolean(),
  aiVersion: z.number().int().nonnegative(),
});

export const adminMessageResultSchema = messageResultSchema.extend(
  conversationAiSchema.shape,
);

export const updateConversationAiSchema = z.object({
  aiEnabled: z.boolean(),
  expectedAiVersion: z.number().int().nonnegative(),
});

export const customerMessageResultSchema = messageResultSchema.extend({
  assistantMessage: messageSchema.nullable(),
  assistantError: z.string().nullable(),
});

export const errorSchema = z.object({ error: z.string() });
