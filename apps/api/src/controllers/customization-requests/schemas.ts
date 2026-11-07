import {
  CUSTOMIZATION_REQUEST_STATUSES,
  CUSTOMIZATION_REQUEST_TYPES,
  MAX_BOOKING_REASON_LENGTH,
  MAX_CUSTOMIZATION_REQUEST_DESCRIPTION_LENGTH,
} from "@event-management/contracts/limits/booking-requests";
import { z } from "@hono/zod-openapi";

export const customizationRequestTypeSchema = z.enum(
  CUSTOMIZATION_REQUEST_TYPES,
);
export const customizationRequestStatusSchema = z.enum(
  CUSTOMIZATION_REQUEST_STATUSES,
);
export const customizationDirectionSchema = z.enum(["add", "deduct"]);

export const customizationRequestSchema = z.object({
  id: z.string().uuid(),
  bookingRequestId: z.string().uuid(),
  conversationId: z.string().uuid().nullable(),
  messageId: z.string().uuid().nullable(),
  type: customizationRequestTypeSchema,
  description: z.string(),
  direction: customizationDirectionSchema.nullable(),
  amountMinor: z.number().int().positive().nullable(),
  status: customizationRequestStatusSchema,
  decisionReason: z.string().nullable(),
  requestedBy: z.string().uuid(),
  requestedByName: z.string(),
  decidedBy: z.string().uuid().nullable(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminCustomizationRequestSchema =
  customizationRequestSchema.extend({
    bookingRequestReference: z.string(),
    customerName: z.string(),
    packageName: z.string(),
    eventType: z.string(),
  });

export const createCustomizationRequestSchema = z
  .object({
    type: customizationRequestTypeSchema,
    description: z
      .string()
      .trim()
      .min(1, "Describe the recorded customization")
      .max(
        MAX_CUSTOMIZATION_REQUEST_DESCRIPTION_LENGTH,
        `Describe the customization in ${MAX_CUSTOMIZATION_REQUEST_DESCRIPTION_LENGTH} characters or fewer`,
      ),
    direction: customizationDirectionSchema.optional(),
    amountMinor: z.number().int().positive().optional(),
    conversationId: z.string().uuid().optional(),
    messageId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.direction == null) === (value.amountMinor == null),
    {
      message: "direction and amountMinor must both be set or both be absent",
      path: ["direction"],
    },
  );

export const decideCustomizationRequestSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z
      .string()
      .trim()
      .max(MAX_BOOKING_REASON_LENGTH)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (value) => value.decision !== "rejected" || Boolean(value.reason),
    {
      message: "A reason is required when rejecting a request",
      path: ["reason"],
    },
  );

export const adminListQuerySchema = z.object({
  status: customizationRequestStatusSchema.optional(),
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
    .optional(),
  cursor: z.string().uuid().optional(),
});

export type CreateCustomizationRequestInput = z.infer<
  typeof createCustomizationRequestSchema
>;
export type CustomizationRequestStatus = z.infer<
  typeof customizationRequestStatusSchema
>;
