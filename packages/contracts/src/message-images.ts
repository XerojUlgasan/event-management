import { z } from "zod";

/** Saved AI observations are uncertain descriptions, never authoritative event facts. */
export const messageImageInterpretationSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    objects: z.array(z.string().trim().min(1).max(120)).max(20),
    colors: z.array(z.string().trim().min(1).max(80)).max(12),
    styles: z.array(z.string().trim().min(1).max(120)).max(12),
    visibleText: z.string().max(2000).nullable(),
    uncertainty: z.array(z.string().trim().min(1).max(300)).max(10),
  })
  .strict();

export type MessageImageInterpretation = z.infer<
  typeof messageImageInterpretationSchema
>;

export const messageImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().positive(),
  interpretation: messageImageInterpretationSchema.nullable(),
});

export type MessageImage = z.infer<typeof messageImageSchema>;

export const messageProcessingSchema = z.object({
  status: z.enum([
    "queued",
    "interpreting",
    "replying",
    "completed",
    "failed",
    "suppressed",
  ]),
  errorCode: z.string().nullable(),
  canRetry: z.boolean(),
  replyPending: z.boolean(),
});

export type MessageProcessing = z.infer<typeof messageProcessingSchema>;
