import {
  catalogBrowseCategorySchema,
  type CatalogBrowse,
} from "@event-management/contracts/messages";
import { tool } from "ai";
import { z } from "zod";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

export function createAttachCatalogBrowseTool({
  db,
  customerMessageId,
  turnId,
  assertActive,
  onPersistenceFailure,
  onCatalogBrowseAttached,
  canRecord = () => true,
  canExecute = () => true,
}: AssistantToolContext & {
  onCatalogBrowseAttached: (categories: CatalogBrowse) => void;
}) {
  let attached: CatalogBrowse | undefined;

  async function persist<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      onPersistenceFailure();
      throw new Error("Catalog browse tracking is unavailable");
    }
  }

  return tool({
    description:
      "Attach public catalog browsing to the next reply for a broad request to see packages, services, or both. " +
      "Call once with the requested categories. This needs no preceding catalog lookups and returns no listings, prices, or availability. " +
      "After success, briefly introduce the attached categories. For a preference, constraint, recommendation, or listing question, use verified catalog lookups instead.",
    inputSchema: z.strictObject({
      categories: z
        .array(catalogBrowseCategorySchema)
        .min(1)
        .max(2)
        .refine((categories) => new Set(categories).size === categories.length),
    }),
    execute: async ({ categories }, { toolCallId, abortSignal }) => {
      if (!canRecord()) {
        onPersistenceFailure();
        throw new Error("The catalog browse call budget was exceeded");
      }

      const call = await persist(
        startToolCallData(db, {
          turnId,
          toolCallId,
          toolName: "attachCatalogBrowse",
          customerMessageId,
          input: { categories },
        }),
      );
      let errorCode = "turn_inactive";

      try {
        if (!canExecute()) {
          errorCode = "call_limit";
          throw new Error("Catalog browse call limit reached");
        }

        await assertActive();
        abortSignal?.throwIfAborted();
      } catch {
        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "failed",
            errorCode: abortSignal?.aborted ? "cancelled" : errorCode,
          }),
        );
        throw new Error("Catalog browsing was not attached");
      }

      const result = {
        status: attached ? "already_attached" : "attached",
        categories: attached ?? [...categories].sort(),
      };
      await persist(
        finishToolCallData(db, {
          id: call.id,
          status: "succeeded",
          output: result,
        }),
      );

      if (!attached) {
        attached = result.categories;
        onCatalogBrowseAttached(attached);
      }

      return result;
    },
  });
}
