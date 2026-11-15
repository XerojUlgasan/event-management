import { z } from "@hono/zod-openapi";
import {
  MAX_AI_CHAT_MESSAGE_LENGTH,
  AI_CHAT_HISTORY_LIMIT,
} from "@event-management/contracts/limits/ai-chat";

export const aiChatRequestSchema = z.object({
  /** UUID of an existing conversation. Omit to use the most recent general conversation
   *  or create a new one automatically. */
  conversationId: z.string().uuid().optional(),
  message: z
    .string()
    .trim()
    .min(1, "Write a message before sending")
    .max(
      MAX_AI_CHAT_MESSAGE_LENGTH,
      `Messages can be at most ${MAX_AI_CHAT_MESSAGE_LENGTH} characters`,
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

export const aiChatResponseSchema = z.object({
  /** The persisted customer message. */
  userMessage: messageSchema,
  /** The AI-generated reply, persisted as an admin message. */
  assistantMessage: messageSchema,
});

export const errorSchema = z.object({ error: z.string() });

// --- Public (no auth) chat ---

export const publicChatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const publicAiChatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Write a message before sending")
    .max(
      MAX_AI_CHAT_MESSAGE_LENGTH,
      `Messages can be at most ${MAX_AI_CHAT_MESSAGE_LENGTH} characters`,
    ),
  /** Optional prior turns so the AI has conversation context.
   *  The client maintains this list and sends it with each request. */
  history: z
    .array(publicChatHistoryItemSchema)
    .max(AI_CHAT_HISTORY_LIMIT)
    .optional(),
});

export const publicAiChatResponseSchema = z.object({
  reply: z.string(),
});
