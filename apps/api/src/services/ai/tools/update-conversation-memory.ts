import { tool } from "ai";
import { z } from "zod";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import { updateConversationMemoryData } from "../../../data/messages/conversation-memory.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

export const maxConversationMemoryCharacters = 2_000;

const updateConversationMemoryInputSchema = z.strictObject({
  markdown: z
    .string()
    .trim()
    .min(1)
    .max(maxConversationMemoryCharacters)
    .refine((markdown) => !markdown.includes("\0"), "Invalid Markdown text"),
});

export function createUpdateConversationMemoryTool({
  db,
  turnId,
  memoryScope: { expectedMemory, ...scope },
  onPersistenceFailure,
  canRecord = () => true,
  canExecute = () => true,
}: AssistantToolContext & {
  memoryScope: NonNullable<AssistantToolContext["memoryScope"]>;
}) {
  async function persist<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      onPersistenceFailure();
      throw new Error("Conversation memory tracking is unavailable");
    }
  }

  return tool({
    description:
      "Save durable details from the saved chat: event type, target guest count (pax), budget, preferred dates, times or venue, style, and service requirements. " +
      "Include relevant options discussed, customer or AMAC team decisions, and open questions. Attribute important statements and mark tentative plans or uncertain image observations. " +
      `Supply the complete concise Markdown replacement, up to ${maxConversationMemoryCharacters} characters. Replace corrected details and preserve still-relevant information. ` +
      "Use the saved transcript as evidence. Omit fresh tool results, the unsent reply, unsupported claims, and unnecessary personal details. Keep the note private.",
    inputSchema: updateConversationMemoryInputSchema,
    execute: async ({ markdown }, { toolCallId, abortSignal }) => {
      if (!canRecord()) {
        onPersistenceFailure();
        throw new Error("The conversation memory call budget was exceeded");
      }

      const call = await persist(
        startToolCallData(db, {
          turnId,
          toolCallId,
          toolName: "updateConversationMemory",
          customerMessageId: scope.customerMessageId,
          input: { markdownCharacters: markdown.length },
        }),
      );

      let errorCode = "call_limit";

      try {
        if (!canExecute()) throw new Error("Memory update call limit reached");

        errorCode = "memory_unavailable";

        return await updateConversationMemoryData({
          db,
          scope,
          expectedMemory,
          markdown,
          callId: call.id,
          abortSignal,
        });
      } catch {
        if (abortSignal?.aborted) errorCode = "cancelled";

        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "failed",
            errorCode,
          }),
        );

        return { status: "skipped" as const };
      }
    },
  });
}
