import { tool } from "ai";
import { requestHumanHandoffInputSchema } from "@event-management/contracts/ai-handoff";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { requestHumanHandoffService } from "../request-human-handoff.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

export function createRequestHumanHandoffTool(
  options: AssistantToolContext & {
    handoffScope: NonNullable<AssistantToolContext["handoffScope"]>;
  },
) {
  return tool({
    description:
      "Pass this conversation to the AMAC team and pause automated replies. " +
      "Use when the customer asks for a human (customer_requested), an admin must review " +
      "a decision (needs_admin_review), or you cannot answer with available evidence " +
      "(cannot_answer). Supply a concise factual summary for the admin. The server binds " +
      "the conversation and message. Success saves the customer acknowledgement; stop afterward. " +
      "This queues review in the inbox, without sending an external notification or promising response time.",
    inputSchema: requestHumanHandoffInputSchema,
    execute: async (input, { toolCallId, abortSignal }) => {
      if (options.isHandoffCommitted?.())
        throw new Error("This conversation has already been handed off");

      if (options.canRecord && !options.canRecord()) {
        options.onPersistenceFailure();
        throw new Error("The handoff call budget was exceeded");
      }

      let call;

      try {
        call = await startToolCallData(options.db, {
          turnId: options.turnId,
          toolCallId,
          toolName: "requestHumanHandoff",
          customerMessageId: options.customerMessageId,
          input,
        });
      } catch {
        options.onPersistenceFailure();
        throw new Error("Handoff tracking is unavailable");
      }

      try {
        if (options.canExecute && !options.canExecute())
          throw new Error("Handoff call limit reached");

        const message = await requestHumanHandoffService({
          db: options.db,
          scope: options.handoffScope,
          input,
          callId: call.id,
          turnId: options.turnId,
          abortSignal,
        });
        options.onHandoffCommitted?.(message);

        return { status: "handed_off" as const };
      } catch {
        try {
          await finishToolCallData(options.db, {
            id: call.id,
            status: "failed",
            errorCode: "handoff_unavailable",
          });
        } catch {
          options.onPersistenceFailure();
        }

        throw new Error(
          "The handoff could not be completed. Do not claim it succeeded.",
        );
      }
    },
  });
}
