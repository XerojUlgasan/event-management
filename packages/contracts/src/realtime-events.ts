import { z } from "zod";
import { chatMessageSchema } from "./messages.js";

export const CONVERSATION_MESSAGE_ADDED = "conversation_message_added";

export const conversationMessageAddedSchema = z
  .object({
    type: z.literal(CONVERSATION_MESSAGE_ADDED),
    delivery: z.literal("inline"),
    conversationId: z.string().uuid(),
    message: chatMessageSchema,
  })
  .strict();

export const realtimeEventSchema = conversationMessageAddedSchema;

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
