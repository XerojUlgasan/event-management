import { sql, type Kysely } from "kysely";
import { z } from "zod";
import type { DB } from "../../db/types.js";
import {
  bookingChatStyleSchema,
  bookingReceiptModelCopySchema,
  bookingReceiptTemplateSchema,
} from "../../services/booking-requests/booking-chat-messages.js";
import type { BookingDraftScope } from "./booking-draft-guard.js";

export const bookingReviewToolOutputSchema = z.object({
  status: z.literal("review_ready"),
  bookingId: z.string().uuid(),
  revision: z.string(),
  aiVersion: z.number().int(),
  catalogFingerprint: z.string(),
});

export const bookingConsentOperation = "assessBookingConsent";

export const bookingConsentInputSchema = z.strictObject({
  reviewMessageId: z.string().uuid(),
  bookingId: z.string().uuid(),
  revision: z.string(),
  aiVersion: z.number().int(),
});

const consentReceiptSchema = bookingReceiptModelCopySchema
  .extend({ style: bookingChatStyleSchema })
  .refine(
    (copy) =>
      copy.style !== "other" ||
      bookingReceiptTemplateSchema.safeParse(copy.receipt).success,
    "A translated receipt is required for other languages",
  );

export const bookingConsentDecisionSchema = z.discriminatedUnion("intent", [
  z.strictObject({
    intent: z.literal("continue"),
    receiptCopy: z.null().optional(),
  }),
  z.strictObject({
    intent: z.literal("submit"),
    receiptCopy: consentReceiptSchema,
  }),
]);

export async function readBookingReviewEvidenceData(
  db: Kysely<DB>,
  scope: BookingDraftScope,
  reviewMessageId: string,
  bookingId: string,
) {
  const [confirmation, summary] = await db
    .selectFrom("messages")
    .select([
      "id",
      "body",
      "sender_role",
      "reply_to_message_id",
      "suggested_replies",
    ])
    .where("conversation_id", "=", scope.conversationId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(2)
    .execute();

  if (
    confirmation?.id !== scope.customerMessageId ||
    summary?.id !== reviewMessageId ||
    summary.sender_role !== "assistant" ||
    !summary.reply_to_message_id
  )
    return { status: "review_changed" as const };

  const record = await db
    .selectFrom("ai_tool_calls as review")
    .innerJoin(
      "messages as trigger",
      "trigger.id",
      "review.customer_message_id",
    )
    .select("review.output")
    .where("review.tool_name", "=", "reviewBookingDraft")
    .where("review.status", "=", "succeeded")
    .where("review.assistant_message_id", "=", summary.id)
    .where("trigger.id", "=", summary.reply_to_message_id)
    .where("trigger.conversation_id", "=", scope.conversationId)
    .where("trigger.sender_role", "=", "customer")
    .where("trigger.sender_id", "=", scope.customerId)
    .where("trigger.guest_origin", "=", false)
    .executeTakeFirst();
  const reviewed = bookingReviewToolOutputSchema.safeParse(record?.output);

  if (
    !reviewed.success ||
    reviewed.data.bookingId !== bookingId ||
    reviewed.data.revision !== scope.expectedRevision ||
    reviewed.data.aiVersion !== scope.aiVersion
  )
    return { status: "review_changed" as const };

  // Review suggestions request clarification or corrections. Even malformed
  // localized copy saved as a suggestion cannot authorize submission.
  if (
    Array.isArray(summary.suggested_replies) &&
    summary.suggested_replies.includes(confirmation.body)
  )
    return { status: "confirmation_required" as const };

  const attachment = await db
    .selectFrom("message_images")
    .select("id")
    .where("message_id", "=", confirmation.id)
    .executeTakeFirst();

  if (attachment) return { status: "confirmation_required" as const };

  // The canonical review ends with a separate invitation paragraph, including
  // retained reviews created before confirmation wording changed.
  const reviewBody = summary.body.trimEnd();
  const invitationStart = reviewBody.lastIndexOf("\n\n");
  const reviewInvitation =
    invitationStart < 0
      ? ""
      : reviewBody.slice(invitationStart + 2, invitationStart + 602);

  return {
    status: "review_ready" as const,
    reply: confirmation.body,
    reviewInvitation,
    catalogFingerprint: reviewed.data.catalogFingerprint,
    input: {
      reviewMessageId,
      bookingId,
      revision: reviewed.data.revision,
      aiVersion: scope.aiVersion,
    },
  };
}

export function bookingConsentAttemptsData(
  db: Kysely<DB>,
  customerMessageId: string,
) {
  return db
    .selectFrom("ai_tool_calls")
    .where("tool_name", "=", bookingConsentOperation)
    .where("customer_message_id", "=", customerMessageId);
}

export async function readCompletedBookingConsentData(
  db: Kysely<DB>,
  customerMessageId: string,
  expected: z.infer<typeof bookingConsentInputSchema>,
) {
  const attempt = await bookingConsentAttemptsData(db, customerMessageId)
    .select(["id", "input", "output"])
    .where("status", "=", "succeeded")
    .orderBy("completed_at", "asc")
    .orderBy("id", "asc")
    .executeTakeFirst();

  if (!attempt) return null;

  const decision = bookingConsentDecisionSchema.safeParse(attempt.output);

  if (!matchesBookingConsentInput(attempt.input, expected) || !decision.success)
    throw new Error("Saved booking consent is unavailable");

  return { id: attempt.id, decision: decision.data };
}

export async function hasBookingReviewHistoryData(
  db: Kysely<DB>,
  conversationId: string,
  bookingId: string,
) {
  const review = await db
    .selectFrom("ai_tool_calls as action")
    .innerJoin("messages as reply", "reply.id", "action.assistant_message_id")
    .select("action.id")
    .where("reply.conversation_id", "=", conversationId)
    .where("action.tool_name", "=", "reviewBookingDraft")
    .where("action.status", "=", "succeeded")
    .where(sql<boolean>`action.output->>'bookingId' = ${bookingId}`)
    .where(sql<boolean>`action.output->>'status' = 'review_ready'`)
    .executeTakeFirst();

  return Boolean(review);
}

export function matchesBookingConsentInput(
  saved: unknown,
  expected: z.infer<typeof bookingConsentInputSchema>,
) {
  const input = bookingConsentInputSchema.safeParse(saved);

  return (
    input.success &&
    input.data.reviewMessageId === expected.reviewMessageId &&
    input.data.bookingId === expected.bookingId &&
    input.data.revision === expected.revision &&
    input.data.aiVersion === expected.aiVersion
  );
}
