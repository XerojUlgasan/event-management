import { z } from "zod";
import {
  messageImageSchema,
  messageProcessingSchema,
} from "./message-images.js";

export const MAX_NEW_CATALOG_RECOMMENDATIONS = 3;
export const MAX_SUGGESTED_REPLIES = 3;

export const suggestedReplySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[^\r\n]+$/u);

const suggestedRepliesSchema = z
  .array(suggestedReplySchema)
  .max(MAX_SUGGESTED_REPLIES);

export const requiredSuggestedRepliesSchema = suggestedRepliesSchema.min(1);

const recommendationFields = {
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
};

export const catalogRecommendationSchema = z.discriminatedUnion("type", [
  z.object({
    ...recommendationFields,
    type: z.literal("package"),
    price: z.object({
      kind: z.literal("fixed"),
      currency: z.literal("PHP"),
      amountMinor: z.number().int().nonnegative(),
    }),
    maxGuests: z.number().int().nonnegative(),
    inclusions: z.array(
      z.object({
        name: z.string(),
        includedHours: z.number().nullable(),
        hourlyRatePesos: z.number().nullable(),
      }),
    ),
  }),
  z.object({
    ...recommendationFields,
    type: z.literal("service"),
    fixedPricePesos: z.number().nullable(),
    hourlyRatePesos: z.number().nullable(),
    includedHours: z.number().nullable(),
  }),
]);

export const catalogRecommendationsSchema = z
  .array(catalogRecommendationSchema)
  .min(1)
  // Saved messages can contain up to five cards.
  .max(5);

export type CatalogRecommendation = z.infer<typeof catalogRecommendationSchema>;

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  images: z.array(messageImageSchema),
  processing: messageProcessingSchema.nullable(),
  quotationId: z.string().uuid().nullable(),
  catalogRecommendations: catalogRecommendationsSchema.optional(),
  suggestedReplies: suggestedRepliesSchema.optional(),
  handoffAcknowledgement: z.literal(true).optional(),
  replyToMessageId: z.string().uuid().nullable(),
  senderId: z.string().uuid().nullable(),
  senderRole: z.enum(["admin", "customer", "assistant"]),
  senderName: z.string(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
