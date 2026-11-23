import type { Kysely } from "kysely";
import { finishToolCallData } from "../../data/ai/finish-tool-call.js";
import {
  guardBookingDraftData,
  readBookingDraftData,
  type BookingDraftScope,
} from "../../data/messages/booking-draft-guard.js";
import {
  bookingConsentAttemptsData,
  bookingConsentDecisionSchema,
  matchesBookingConsentInput,
  readBookingReviewEvidenceData,
} from "../../data/messages/booking-review-evidence.js";
import { createAssistantMessageInTransactionData } from "../../data/messages/create-assistant-message.js";
import type { DB } from "../../db/types.js";
import { createBookingRequestInTransaction } from "./create-booking-request.js";
import { bookingRequestReceipt } from "./booking-chat-messages.js";
import {
  fallbackReplyLanguage,
  suggestedReplyCopy,
  usableSuggestedReplies,
} from "../messages/suggested-reply-copy.js";
import { resolveBookingDraft } from "./resolve-booking-draft.js";

export function submitReviewedBookingRequestService({
  db,
  scope,
  reviewMessageId,
  consentAttemptId,
  callId,
  turnId,
  abortSignal,
}: {
  db: Kysely<DB>;
  scope: BookingDraftScope;
  reviewMessageId: string | null;
  consentAttemptId: string | null;
  callId: string;
  turnId: string;
  abortSignal?: AbortSignal;
}) {
  return db.transaction().execute(async (trx) => {
    const conversation = await guardBookingDraftData(trx, scope, abortSignal);

    if (!conversation) throw new Error("Draft turn is no longer active");

    async function finishWithoutSubmission<
      Status extends
        "review_changed" | "sign_in_required" | "confirmation_required",
    >(status: Status) {
      const output = { status };
      await finishToolCallData(trx, {
        id: callId,
        status: "succeeded",
        output,
      });
      abortSignal?.throwIfAborted();

      return output;
    }

    const customerId = conversation.customer_id;

    if (!customerId || scope.guestIdentityId)
      return finishWithoutSubmission("sign_in_required");

    if (!reviewMessageId) return finishWithoutSubmission("review_changed");

    const draft = await readBookingDraftData(trx, scope.conversationId);

    if (!draft || draft.revision !== scope.expectedRevision)
      return finishWithoutSubmission("review_changed");

    const review = await readBookingReviewEvidenceData(
      trx,
      scope,
      reviewMessageId,
      draft.id,
    );

    if (review.status !== "review_ready")
      return finishWithoutSubmission(review.status);

    const recordedConsent = consentAttemptId
      ? await bookingConsentAttemptsData(trx, scope.customerMessageId)
          .select(["input", "output"])
          .where("id", "=", consentAttemptId)
          .where("status", "=", "succeeded")
          .executeTakeFirst()
      : undefined;
    const decision = bookingConsentDecisionSchema.safeParse(
      recordedConsent?.output,
    );

    if (
      !matchesBookingConsentInput(recordedConsent?.input, review.input) ||
      !decision.success ||
      decision.data.intent !== "submit"
    )
      return finishWithoutSubmission("confirmation_required");

    const resolved = await resolveBookingDraft(trx, draft.fields, true);

    if (
      !resolved.createInput ||
      review.catalogFingerprint !== resolved.catalogFingerprint
    )
      return finishWithoutSubmission("review_changed");

    abortSignal?.throwIfAborted();
    const booking = await createBookingRequestInTransaction(
      trx,
      customerId,
      { ...resolved.createInput, conversationId: scope.conversationId },
      {
        budget: draft.fields.budget,
        requestedServices: resolved.requestedServices,
      },
    );

    if ("message" in booking) return finishWithoutSubmission("review_changed");

    await finishToolCallData(trx, {
      id: callId,
      status: "succeeded",
      output: { status: "submitted", bookingId: booking.id },
    });
    const receiptCopy = decision.data.receiptCopy;
    const body = bookingRequestReceipt(booking.reference, receiptCopy);
    const translatedReply = usableSuggestedReplies([receiptCopy.nextReply]);
    const suggestedReplies =
      receiptCopy.style === "other"
        ? translatedReply.length
          ? translatedReply
          : suggestedReplyCopy(fallbackReplyLanguage([body])).receipt
        : suggestedReplyCopy(receiptCopy.style).receipt;
    const message = await createAssistantMessageInTransactionData(trx, {
      conversationId: scope.conversationId,
      customerId,
      toolTurn: { turnId, customerMessageId: scope.customerMessageId },
      body,
      suggestedReplies,
    });
    abortSignal?.throwIfAborted();

    return { status: "submitted" as const, message };
  });
}
