import {
  MAX_CATALOG_RECOMMENDATIONS,
  type CatalogRecommendation,
} from "@event-management/contracts/messages";
import { tool } from "ai";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import {
  attachCatalogRecommendationsInputSchema,
  buildCatalogRecommendations,
} from "../catalog-recommendations.js";
import type { AssistantToolContext } from "./assistant-tool-context.js";

export function createAttachCatalogRecommendationsTool({
  db,
  customerMessageId,
  turnId,
  assertActive,
  onPersistenceFailure,
  onRecommendationsAttached,
  canRecord = () => true,
  canExecute = () => true,
}: AssistantToolContext & {
  onRecommendationsAttached: (items: CatalogRecommendation[]) => void;
}) {
  let attached:
    Pick<CatalogRecommendation, "id" | "type" | "name">[] | undefined;

  async function persist<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      onPersistenceFailure();
      throw new Error("Catalog recommendation tracking is unavailable");
    }
  }

  return tool({
    description:
      "Attach an ordered shortlist of public packages and services below your next chat reply. " +
      `Pass up to ${MAX_CATALOG_RECOMMENDATIONS} distinct {catalogType, id} pairs from successful catalog lookups in this turn. ` +
      "Before recommending an item based on its inclusions, read its catalog details. " +
      "Call once with the full list you are presenting. The resulting cards are the recommendation list. Then write a short reply that introduces the list without repeating it. Attaching is for browsing and does not select or book anything.",
    inputSchema: attachCatalogRecommendationsInputSchema,
    execute: async ({ items }, { toolCallId, abortSignal }) => {
      if (!canRecord()) {
        onPersistenceFailure();
        throw new Error("The catalog recommendation call budget was exceeded");
      }

      const call = await persist(
        startToolCallData(db, {
          turnId,
          toolCallId,
          toolName: "attachCatalogRecommendations",
          customerMessageId,
          input: { items },
        }),
      );
      let errorCode = "turn_inactive";

      try {
        if (!canExecute()) {
          errorCode = "call_limit";
          throw new Error("Catalog recommendation call limit reached");
        }

        await assertActive();
        abortSignal?.throwIfAborted();

        if (attached) {
          const result = { status: "already_attached", items: attached };
          await persist(
            finishToolCallData(db, {
              id: call.id,
              status: "succeeded",
              output: result,
            }),
          );

          return result;
        }

        errorCode = "recommendations_unavailable";
        const recommendations = await buildCatalogRecommendations({
          db,
          turnId,
          customerMessageId,
          items,
        });

        if (!recommendations) {
          errorCode = "invalid_recommendations";
          throw new Error("Catalog items could not be verified");
        }

        errorCode = "turn_inactive";
        await assertActive();
        abortSignal?.throwIfAborted();

        const result = {
          status: "attached",
          items: recommendations.map(({ id, type, name }) => ({
            id,
            type,
            name,
          })),
        };

        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "succeeded",
            output: result,
          }),
        );
        attached = result.items;
        onRecommendationsAttached(recommendations);

        return result;
      } catch {
        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "failed",
            errorCode: abortSignal?.aborted ? "cancelled" : errorCode,
          }),
        );
        throw new Error(
          "Catalog recommendations were not attached. Use distinct public items from successful catalog lookups in the current turn, or answer with the verified facts you have.",
        );
      }
    },
  });
}
