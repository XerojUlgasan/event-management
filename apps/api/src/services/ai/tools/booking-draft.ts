import { tool } from "ai";
import { z } from "zod";
import { bookingDraftPatchSchema } from "@event-management/contracts/booking-draft";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import {
  updateBookingDraftData,
  discardBookingDraftData,
} from "../../../data/messages/booking-draft-update.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

type DraftOptions = AssistantToolContext & {
  draftScope: NonNullable<AssistantToolContext["draftScope"]>;
};

async function start(
  options: DraftOptions,
  toolCallId: string,
  toolName: string,
  input: object,
) {
  if (options.canRecord && !options.canRecord()) {
    options.onPersistenceFailure();
    throw new Error("Draft tracking budget exceeded");
  }

  try {
    return await startToolCallData(options.db, {
      turnId: options.turnId,
      toolCallId,
      toolName,
      customerMessageId: options.customerMessageId,
      input,
    });
  } catch {
    options.onPersistenceFailure();
    throw new Error("Draft tracking unavailable");
  }
}

async function fail(options: DraftOptions, id: string) {
  try {
    await finishToolCallData(options.db, {
      id,
      status: "failed",
      errorCode: "draft_unavailable",
    });
  } catch {
    options.onPersistenceFailure();
  }

  throw new Error(
    "The booking draft could not be updated. Do not claim it succeeded.",
  );
}

export function createBookingDraftTools(options: DraftOptions) {
  return {
    updateBookingDraft: tool({
      description:
        "Set discard to true only when the customer clearly asks to discard their unsent draft; do not combine it with other fields. Save customer-stated booking details or explicit corrections as a private inquiry draft. When the customer seeks recommendations for their own event, save the event facts and stated budget before or alongside the catalog search, without waiting for a package choice. Preserve budget as stated, even when its scope is unclear; ask before applying a package price filter. Reconcile earlier customer-stated event facts if missing from the draft. Generic catalog questions without event-planning intent do not start a draft. Only include facts the customer supplied or confirmed. Omitted fields stay unchanged; null clears a scalar. Put each explicitly requested extra service in upsertServices, including unlisted services as {customName: customer's wording, hours: requested hours if stated}. For example, a bilingual host is upsertServices: [{customName: 'bilingual host'}], not just specialRequests. Use serviceId only for a selected catalog service. Use specialRequests for other logistics and requirements. Upsert or remove specific requested services without replacing others. A suggested package or service is not selected until the customer chooses it. Never invent IDs, prices, dates, or customer details. This does not submit a request.",
      inputSchema: bookingDraftPatchSchema.extend({
        discard: z.boolean().optional(),
      }),
      execute: async (patch, { toolCallId, abortSignal }) => {
        const carryBudget =
          !patch.discard &&
          options.draftScope.expectedRevision === null &&
          patch.budget === undefined &&
          Boolean(patch.eventType || patch.packageId) &&
          Boolean(options.carryForwardBudget);
        const call = await start(options, toolCallId, "updateBookingDraft", {
          fields: Object.keys(patch),
          ...(carryBudget ? { carriedBudget: true } : {}),
        });

        try {
          if (options.canExecute && !options.canExecute())
            throw new Error("Call limit");

          const { discard, ...fields } = patch;

          if (discard && Object.keys(fields).length)
            throw new Error("Discard cannot be combined with updates");

          if (carryBudget) fields.budget = options.carryForwardBudget;

          const result = discard
            ? await discardBookingDraftData({
                db: options.db,
                scope: options.draftScope,
                callId: call.id,
                abortSignal,
              })
            : await updateBookingDraftData({
                db: options.db,
                scope: options.draftScope,
                patch: fields,
                callId: call.id,
                abortSignal,
              });

          if ("revision" in result)
            options.draftScope.expectedRevision = result.revision;

          if (result.status === "updated" || result.status === "unchanged") {
            const { missingFields, ...update } = result;

            if (update.invalidSelections.length === 0)
              options.onDraftChanged?.(
                patch.packageId != null ||
                  Boolean(patch.upsertServices?.length),
                missingFields.length === 0,
              );

            return { ...update, nextMissingField: missingFields[0] ?? null };
          }

          return result;
        } catch {
          return fail(options, call.id);
        }
      },
    }),
  };
}
