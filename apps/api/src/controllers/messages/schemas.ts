import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import { z } from "@hono/zod-openapi";

export const messageBodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending")
    .max(MAX_MESSAGE_BODY_LENGTH, `Messages can be at most ${MAX_MESSAGE_BODY_LENGTH} characters`),
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

export const conversationStatusSchema = z.enum([
  "active",
  "closed",
]);

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

export const adminConversationsPageSchema = conversationsSchema.extend({
  nextCursor: z.string().nullable(),
});

export const messageResultSchema = z.object({
  message: messageSchema,
});

const dateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date and time");

export const conversationContextSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
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

export const errorSchema = z.object({ error: z.string() });
