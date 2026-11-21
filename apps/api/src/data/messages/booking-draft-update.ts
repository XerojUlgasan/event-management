import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import {
  applyBookingDraftPatch,
  type BookingDraftPatch,
} from "@event-management/contracts/booking-draft";
import { MAX_SPECIAL_REQUESTS_LENGTH } from "@event-management/contracts/limits/booking-requests";
import type { DB } from "../../db/types.js";
import { finishToolCallData } from "../ai/finish-tool-call.js";
import {
  bookingRevision,
  nextBookingRevision,
} from "../booking-requests/booking-revision.js";
import {
  guardBookingDraftData,
  readBookingDraftData,
  type BookingDraftScope,
} from "./booking-draft-guard.js";
import { resolveBookingDraft } from "../../services/booking-requests/resolve-booking-draft.js";

export function updateBookingDraftData({
  db,
  scope,
  patch,
  callId,
  abortSignal,
}: {
  db: Kysely<DB>;
  scope: BookingDraftScope;
  patch: BookingDraftPatch;
  callId: string;
  abortSignal?: AbortSignal;
}) {
  return db.transaction().execute(async (trx) => {
    const conversation = await guardBookingDraftData(trx, scope, abortSignal);

    if (!conversation) throw new Error("Draft turn is no longer active");

    const previous = await readBookingDraftData(trx, scope.conversationId);

    if (
      (previous?.revision ?? null) !== scope.expectedRevision ||
      (conversation.booking_request_id && !previous)
    ) {
      const result = { status: "revision_changed" as const };
      await finishToolCallData(trx, {
        id: callId,
        status: "succeeded",
        output: result,
      });

      return result;
    }

    const fields = previous?.fields ?? {};
    const notes = fields.specialRequests;
    const legacyNotes = notes && notes.length > MAX_SPECIAL_REQUESTS_LENGTH;
    const next = applyBookingDraftPatch(
      legacyNotes ? { ...fields, specialRequests: undefined } : fields,
      patch,
    );

    if (legacyNotes && patch.specialRequests === undefined)
      next.specialRequests = notes;

    if (!next.requestedDates?.length) delete next.requestedDates;

    const resolved = await resolveBookingDraft(
      trx,
      next,
      patch.packageId != null,
    );

    const invalidSelections = resolved.missingFields.filter(
      (field) => field === "packageId" || field === "requestedServices",
    );

    // A package ID must refer to an available catalog row before it can
    // replace the current selection. Keep other valid edits from this turn.
    const invalidPackage =
      patch.packageId != null && invalidSelections.includes("packageId");
    let outOfRange = resolved.outOfRange;

    if (invalidPackage) {
      if (fields.packageId) {
        next.packageId = fields.packageId;
        outOfRange = (await resolveBookingDraft(trx, next)).outOfRange;
      } else {
        delete next.packageId;
      }
    }

    const changed = JSON.stringify(fields) !== JSON.stringify(next);
    let revision = previous?.revision ?? null;

    if (changed) {
      const requestedDays = next.requestedDates?.map((date) => ({
        date,
        startsAt: null,
        endsAt: null,
      }));

      const values = {
        package_id: next.packageId ?? null,
        event_type: next.eventType ?? null,
        duration_mode: next.durationMode ?? null,
        preferred_date: requestedDays?.[0]?.date ?? null,
        requested_days: requestedDays?.length
          ? JSON.stringify(requestedDays)
          : null,
        time_zone: next.timeZone ?? null,
        guest_count: next.guestCount ?? null,
        contact_name: next.contactName ?? null,
        phone_number: next.phoneNumber ?? null,
        preferred_venue_location: next.preferredVenueLocation ?? null,
        special_requests: next.specialRequests ?? null,
        budget: next.budget ?? null,
        requested_services: next.requestedServices
          ? JSON.stringify(next.requestedServices)
          : null,
        out_of_range: outOfRange,
      };
      const draft = previous
        ? await trx
            .updateTable("booking_requests")
            .set({ ...values, updated_at: nextBookingRevision })
            .where("id", "=", previous.id)
            .where("submitted_at", "is", null)
            .returning(["id", bookingRevision.as("revision")])
            .executeTakeFirstOrThrow()
        : await trx
            .insertInto("booking_requests")
            .values({
              ...values,
              customer_id: conversation.customer_id,
              reference: `BR-${randomUUID().toUpperCase()}`,
              submitted_at: null,
            })
            .returning(["id", bookingRevision.as("revision")])
            .executeTakeFirstOrThrow();

      if (!previous)
        await trx
          .updateTable("conversations")
          .set({ booking_request_id: draft.id })
          .where("id", "=", scope.conversationId)
          .execute();

      revision = draft.revision;
    }

    const output = {
      status: changed ? ("updated" as const) : ("unchanged" as const),
      revision,
      invalidSelections,
    };
    await finishToolCallData(trx, { id: callId, status: "succeeded", output });
    abortSignal?.throwIfAborted();

    return {
      ...output,
      missingFields: resolved.missingFields,
      warnings: resolved.warnings,
    };
  });
}

export function discardBookingDraftData({
  db,
  scope,
  callId,
  abortSignal,
}: {
  db: Kysely<DB>;
  scope: BookingDraftScope;
  callId: string;
  abortSignal?: AbortSignal;
}) {
  return db.transaction().execute(async (trx) => {
    const conversation = await guardBookingDraftData(trx, scope, abortSignal);

    if (!conversation) throw new Error("Draft turn is no longer active");

    const draft = await readBookingDraftData(trx, scope.conversationId);

    if (
      (draft?.revision ?? null) !== scope.expectedRevision ||
      (conversation.booking_request_id && !draft)
    ) {
      const result = { status: "revision_changed" as const };
      await finishToolCallData(trx, {
        id: callId,
        status: "succeeded",
        output: result,
      });

      return result;
    }

    if (draft) {
      await trx
        .updateTable("conversations")
        .set({ booking_request_id: null })
        .where("id", "=", scope.conversationId)
        .execute();
      await trx
        .deleteFrom("booking_requests")
        .where("id", "=", draft.id)
        .where("submitted_at", "is", null)
        .executeTakeFirstOrThrow();
    }

    const result = { status: "discarded" as const, revision: null };
    await finishToolCallData(trx, {
      id: callId,
      status: "succeeded",
      output: result,
    });
    abortSignal?.throwIfAborted();

    return result;
  });
}
