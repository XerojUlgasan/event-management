import { z } from "zod";

export const AI_HANDOFF_REASONS = [
  "customer_requested",
  "needs_admin_review",
  "cannot_answer",
] as const;

export const MAX_AI_HANDOFF_SUMMARY_LENGTH = 1_000;

export const requestHumanHandoffInputSchema = z
  .object({
    reason: z.enum(AI_HANDOFF_REASONS),
    summary: z.string().trim().min(1).max(MAX_AI_HANDOFF_SUMMARY_LENGTH),
  })
  .strict();

export const aiHandoffSchema = requestHumanHandoffInputSchema.extend({
  pending: z.boolean(),
});

export type AiHandoff = z.infer<typeof aiHandoffSchema>;
