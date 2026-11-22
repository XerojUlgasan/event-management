import { z } from "zod";

const uuid = z.uuid().transform((id) => id.toLowerCase());

export const imageMessageJobPayloadSchema = z
  .object({
    messageId: uuid,
    conversationId: uuid,
    aiVersion: z.number().int().nonnegative().nullable(),
    suppressReply: z.literal(true).optional(),
  })
  .strict();
