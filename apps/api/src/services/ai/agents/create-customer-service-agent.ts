import { isStepCount, ToolLoopAgent } from "ai";
import { getTextModel } from "../models.js";
import { customerServicePrompt } from "../prompts/customer-service-prompt.js";
import { createSearchPublicCatalogTool } from "../tools/search-public-catalog.js";
import { createGetPublicCatalogItemTool } from "../tools/get-public-catalog-item.js";
import type { AssistantToolContext } from "../tools/assistant-tool-context.js";

export function createCustomerServiceAgent(options: AssistantToolContext) {
  let proposedCalls = 0;
  let executedCalls = 0;
  const toolContext = {
    ...options,
    canRecord: () => proposedCalls <= 12,
    canExecute: () => ++executedCalls <= 6,
  };
  return new ToolLoopAgent({
    model: getTextModel(),
    instructions: customerServicePrompt,
    tools: {
      searchPublicCatalog: createSearchPublicCatalogTool(toolContext),
      getPublicCatalogItem: createGetPublicCatalogItemTool(toolContext),
    },
    stopWhen: isStepCount(4),
    // Reserve the fourth generation for an answer using the available evidence.
    prepareStep: ({ stepNumber }) =>
      stepNumber >= 3 ? { toolChoice: "none" } : {},
    toolCallConcurrency: 1,
    onLanguageModelCallEnd: ({ content }) => {
      proposedCalls += content.filter(
        (part) => part.type === "tool-call",
      ).length;
      // Reject an oversized provider response before any tools from it execute.
      // At most six catalog operations execute across both tools.
    },
    maxRetries: 0,
    maxOutputTokens: 800,
    reasoning: "none",
  });
}
