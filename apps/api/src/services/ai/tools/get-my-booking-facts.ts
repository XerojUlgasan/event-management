import { tool } from "ai";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import {
  BookingFactAccessDenied,
  getMyBookingFactInputSchema,
  getMyRequestHistoryService,
  getMySentQuotationService,
  type MyRequestHistoryResult,
  type MySentQuotationResult,
} from "../get-my-booking-facts.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

type BookingFactToolContext = AssistantToolContext & {
  customerScope: { customerId: string; conversationId: string };
  consumeResultCharacters: (characters: number) => boolean;
};

type ToolName = "getMySentQuotation" | "getMyRequestHistory";

type BookingFactResult = MySentQuotationResult | MyRequestHistoryResult;

function createGetMyBookingFactTool({
  db,
  customerMessageId,
  turnId,
  customerScope,
  assertActive,
  onPersistenceFailure,
  consumeResultCharacters,
  canRecord = () => true,
  canExecute = () => true,
  toolName,
  description,
  read,
  audit,
}: BookingFactToolContext & {
  toolName: ToolName;
  description: string;
  read: (input: {
    db: typeof db;
    customerId: string;
    conversationId: string;
    abortSignal?: AbortSignal;
  }) => Promise<BookingFactResult>;
  audit: (result: BookingFactResult) => Record<string, unknown>;
}) {
  async function persist<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      onPersistenceFailure();
      throw new Error("Booking fact tracking is unavailable");
    }
  }

  return tool({
    description,
    inputSchema: getMyBookingFactInputSchema,
    execute: async (input, { toolCallId, abortSignal }) => {
      if (!canRecord()) {
        onPersistenceFailure();
        throw new Error("The booking fact call budget was exceeded");
      }

      const call = await persist(
        startToolCallData(db, {
          turnId,
          toolCallId,
          toolName,
          customerMessageId,
          input,
        }),
      );
      let errorCode = "booking_fact_unavailable";

      try {
        if (!canExecute()) {
          errorCode = "call_limit";
          throw new Error("Booking fact call limit reached");
        }

        errorCode = "turn_inactive";
        await assertActive();
        abortSignal?.throwIfAborted();
        errorCode = "booking_fact_unavailable";
        const result = await read({ db, ...customerScope, abortSignal });
        const encoded = JSON.stringify(result);

        if (!consumeResultCharacters(encoded.length)) {
          errorCode = "booking_fact_too_large";
          throw new Error(
            "Booking fact exceeds the remaining turn input budget",
          );
        }

        errorCode = "turn_inactive";
        await assertActive();
        abortSignal?.throwIfAborted();
        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "succeeded",
            output: audit(result),
          }),
        );

        return result;
      } catch (error) {
        if (error instanceof BookingFactAccessDenied)
          errorCode = "access_denied";

        if (abortSignal?.aborted) errorCode = "cancelled";

        await persist(
          finishToolCallData(db, { id: call.id, status: "failed", errorCode }),
        );

        throw new Error(
          "The current conversation's booking facts are unavailable for this call. " +
            "Do not invent details, treat this as an empty result, or use old history as current evidence.",
        );
      }
    },
  });
}

export function createGetMySentQuotationTool(context: BookingFactToolContext) {
  return createGetMyBookingFactTool({
    ...context,
    toolName: "getMySentQuotation",
    description:
      "Read the latest delivered quotation for the current conversation's booking request. Takes no arguments; the server supplies customer and conversation scope. Returns only the latest delivered offer with its saved line descriptions and amounts in pesos; do not rescale them. Drafts and revision history are not returned. no_linked_request and no_sent_quotation are explicit normal outcomes. The result is current evidence, not a booking confirmation or payment record.",
    read: getMySentQuotationService,
    audit: (result) =>
      result.status === "found" && "quotation" in result
        ? {
            status: "found",
            version: result.quotation.version,
            sentAt: result.quotation.sentAt,
          }
        : { status: result.status },
  });
}

export function createGetMyRequestHistoryTool(context: BookingFactToolContext) {
  return createGetMyBookingFactTool({
    ...context,
    toolName: "getMyRequestHistory",
    description:
      "Read the latest customer-visible status change for the current conversation's booking request. Takes no arguments; the server supplies customer and conversation scope. Returns only status, optional reason, and time. no_linked_request and no_status_history are explicit normal outcomes. The result is current evidence, not a booking confirmation or operational schedule.",
    read: getMyRequestHistoryService,
    audit: (result) =>
      result.status === "found" && "latestChange" in result
        ? {
            status: "found",
            requestStatus: result.latestChange.status,
            changedAt: result.latestChange.createdAt,
          }
        : { status: result.status },
  });
}
