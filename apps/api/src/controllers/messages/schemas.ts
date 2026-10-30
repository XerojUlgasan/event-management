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
  senderId: z.string().uuid().nullable(),
  senderRole: z.enum(["admin", "customer", "assistant", "system"]),
  senderName: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const conversationStatusSchema = z.enum([
  "active",
  "waiting_staff",
  "staff",
  "closed",
]);

export const conversationSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string(),
  packageId: z.string().uuid().nullable(),
  packageName: z.string().nullable(),
  eventType: z.string().nullable(),
  eventStartsAt: z.string().nullable(),
  eventEndsAt: z.string().nullable(),
  guestCount: z.number().int().positive().nullable(),
  status: conversationStatusSchema,
  closedAt: z.string().nullable(),
  expiresAt: z.string(),
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

const dateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date and time");

export const conversationContextSchema = z
  .object({
    packageId: z.string().uuid().nullable().optional(),
    eventType: z.string().trim().max(120).nullable().optional(),
    eventStartsAt: dateTime.nullable().optional(),
    eventEndsAt: dateTime.nullable().optional(),
    guestCount: z.number().int().min(1).max(100000).nullable().optional(),
  })
  .refine(
    (value) =>
      !value.eventStartsAt ||
      !value.eventEndsAt ||
      Date.parse(value.eventEndsAt) >= Date.parse(value.eventStartsAt),
    { message: "Event end must be after the event start", path: ["eventEndsAt"] },
  );

const guestMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  body: z.string().trim().min(1).max(4000),
  createdAt: dateTime.optional(),
});

export const claimConversationSchema = z.object({
  guestChatId: z.string().trim().min(8).max(100),
  messages: z.array(guestMessageSchema).max(50),
  context: conversationContextSchema.optional(),
});

export const assistantReplySchema = z.object({
  message: messageSchema.nullable(),
  status: conversationStatusSchema,
});

export const errorSchema = z.object({ error: z.string() });
