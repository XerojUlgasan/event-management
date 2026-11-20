import { z } from "zod";
import {
  messageImageSchema,
  messageProcessingSchema,
} from "./message-images.js";

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  images: z.array(messageImageSchema),
  processing: messageProcessingSchema.nullable(),
  quotationId: z.string().uuid().nullable(),
  replyToMessageId: z.string().uuid().nullable(),
  senderId: z.string().uuid().nullable(),
  senderRole: z.enum(["admin", "customer", "assistant"]),
  senderName: z.string(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
