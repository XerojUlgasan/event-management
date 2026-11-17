import { isStepCount, ToolLoopAgent } from "ai";
import { getTextModel } from "../models.js";
import { customerServicePrompt } from "../prompts/customer-service-prompt.js";
import { createSearchPublicCatalogTool } from "../tools/search-public-catalog.js";

export function createCustomerServiceAgent(
  options: Parameters<typeof createSearchPublicCatalogTool>[0],
) {
  let proposedCalls = 0;
  return new ToolLoopAgent({
    model: getTextModel(),
    instructions: customerServicePrompt,
    tools: {
      searchPublicCatalog: createSearchPublicCatalogTool({
        ...options,
        canRecord: () => proposedCalls <= 12,
      }),
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
      // At most six searches execute; bounded additional calls record rejection.
    },
    maxRetries: 0,
    maxOutputTokens: 800,
    reasoning: "none",
  });
}
