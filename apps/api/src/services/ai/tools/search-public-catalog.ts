import { tool } from "ai";
import type { AssistantToolContext } from "./assistant-tool-context.js";
import { startToolCallData } from "../../../data/ai/start-tool-call.js";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import {
  searchPublicCatalogInputSchema,
  searchPublicCatalogService,
} from "../search-public-catalog.js";

export function createSearchPublicCatalogTool({
  db,
  customerMessageId,
  turnId,
  assertActive,
  onPersistenceFailure,
  canRecord = () => true,
  canExecute = () => true,
}: AssistantToolContext) {
  let calls = 0;
  async function persist<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch {
      onPersistenceFailure();
      throw new Error("Catalog search tracking is unavailable");
    }
  }

  return tool({
    description:
      "Search customer-visible catalog packages or services. Choose catalogType. " +
      "Use package pax for the customer's guest count; each result's maximumGuestCapacity is its maximum, not a minimum number of guests. Use minPricePesos/maxPricePesos for package prices only when the customer explicitly says the budget is for the package. An event budget or 'my budget is PHP 80,000' is not necessarily a package budget: omit both price filters and ask which scope applies. " +
      "For service price filters choose pricingType: fixed (price for includedHours, with possible excess-hour rate) " +
      "or hourly (hourly-only services). Pax does not apply to services. " +
      "Optional query ranks fresh indexed evidence semantically; omit query to browse by exact filters without embeddings. " +
      "Return at most five unique listings. To continue, reuse the exact filters/query with the returned cursor. " +
      "Use only catalog keywords in query, without customer contact information. " +
      "Results are catalog terms, not quotations, availability checks or booking confirmation.",
    inputSchema: searchPublicCatalogInputSchema,
    execute: async (input, { toolCallId, abortSignal }) => {
      if (!canRecord()) {
        onPersistenceFailure();
        throw new Error("The catalog search call budget was exceeded");
      }

      const call = await persist(
        startToolCallData(db, {
          turnId,
          toolCallId,
          toolName: "searchPublicCatalog",
          customerMessageId,
          input,
        }),
      );
      let errorCode = "search_unavailable";

      try {
        if (++calls > 6 || !canExecute()) {
          errorCode = "call_limit";
          throw new Error("Search call limit reached");
        }

        errorCode = "turn_inactive";
        await assertActive();
        abortSignal?.throwIfAborted();
        errorCode = "search_unavailable";
        const output = await searchPublicCatalogService({
          db,
          input,
          abortSignal,
        });
        errorCode = "turn_inactive";
        await assertActive();
        abortSignal?.throwIfAborted();
        await persist(
          finishToolCallData(db, { id: call.id, status: "succeeded", output }),
        );

        return output;
      } catch {
        if (abortSignal?.aborted) errorCode = "cancelled";

        await persist(
          finishToolCallData(db, {
            id: call.id,
            status: "failed",
            errorCode,
          }),
        );
        // SDK tool errors enter model context. Never forward provider or DB errors.
        throw new Error(
          "Catalog search is unavailable for this call. Do not treat this as no matching items or invent catalog facts.",
        );
      }
    },
    toModelOutput: ({ output }) => ({
      type: "json",
      value: {
        ...output,
        results: output.results.map(({ capacity, ...result }) => ({
          ...result,
          maximumGuestCapacity: capacity,
        })),
      },
    }),
  });
}
