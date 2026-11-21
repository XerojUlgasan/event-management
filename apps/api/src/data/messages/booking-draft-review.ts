import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  bookingReviewBody,
  bookingReviewPresets,
  type BookingReviewCopy,
} from "../../services/booking-requests/booking-chat-messages.js";
import { resolveBookingDraft } from "../../services/booking-requests/resolve-booking-draft.js";
import { finishToolCallData } from "../ai/finish-tool-call.js";
import {
  guardBookingDraftData,
  readBookingDraftData,
  type BookingDraftScope,
} from "./booking-draft-guard.js";
import { createAssistantMessageInTransactionData } from "./create-assistant-message.js";

export function reviewBookingDraftData({
  db,
  scope,
  callId,
  turnId,
  copy = bookingReviewPresets.en,
  abortSignal,
}: {
  db: Kysely<DB>;
  scope: BookingDraftScope;
  callId: string;
  turnId: string;
  copy?: BookingReviewCopy;
  abortSignal?: AbortSignal;
}) {
  return db.transaction().execute(async (trx) => {
    const conversation = await guardBookingDraftData(trx, scope, abortSignal);

    if (!conversation) throw new Error("Draft turn is no longer active");

    const draft = await readBookingDraftData(trx, scope.conversationId);

    if ((draft?.revision ?? null) !== scope.expectedRevision) {
      const result = { status: "revision_changed" as const };
      await finishToolCallData(trx, {
        id: callId,
        status: "succeeded",
        output: result,
      });

      return result;
    }

    if (!draft) {
      const result = { status: "no_draft" as const };
      await finishToolCallData(trx, {
        id: callId,
        status: "succeeded",
        output: result,
      });

      return result;
    }

    const resolved = await resolveBookingDraft(trx, draft.fields, true);

    if (!resolved.createInput) {
      const output = {
        status: "incomplete" as const,
        missingFields: resolved.missingFields,
      };
      await finishToolCallData(trx, {
        id: callId,
        status: "succeeded",
        output,
      });

      return { ...output, warnings: resolved.warnings };
    }

    abortSignal?.throwIfAborted();

    const output = {
      status: "review_ready" as const,
      bookingId: draft.id,
      revision: draft.revision,
      aiVersion: scope.aiVersion,
      catalogFingerprint: resolved.catalogFingerprint,
    };
    await finishToolCallData(trx, { id: callId, status: "succeeded", output });
    const message = await createAssistantMessageInTransactionData(trx, {
      conversationId: scope.conversationId,
      customerId: conversation.customer_id,
      toolTurn: { turnId, customerMessageId: scope.customerMessageId },
      body: bookingReviewBody(
        draft.fields,
        resolved,
        !!scope.guestIdentityId,
        copy,
      ),
    });
    abortSignal?.throwIfAborted();

    return { status: "review_ready" as const, message };
  });
}
