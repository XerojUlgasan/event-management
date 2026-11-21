import { isStepCount, ToolLoopAgent } from "ai";
import { createRequestHumanHandoffTool } from "../tools/request-human-handoff.js";
import { getTextModel } from "../models.js";
import { customerServicePrompt } from "../prompts/customer-service-prompt.js";
import { createSearchPublicCatalogTool } from "../tools/search-public-catalog.js";
import { createGetBusinessInformationTool } from "../tools/get-business-information.js";
import { createGetPublicCatalogItemTool } from "../tools/get-public-catalog-item.js";
import { createGetMyProposalTool } from "../tools/get-my-proposal.js";
import {
  createGetMyRequestHistoryTool,
  createGetMySentQuotationTool,
} from "../tools/get-my-booking-facts.js";
import { createUpdateConversationMemoryTool } from "../tools/update-conversation-memory.js";
import type { AssistantToolContext } from "../tools/assistant-tool-context.js";
import { createBookingDraftTools } from "../tools/booking-draft.js";

export function createCustomerServiceAgent(options: AssistantToolContext) {
  let proposedCalls = 0;
  let executedCalls = 0;
  let trackingUnavailable = false;
  let resultCharactersRemaining = options.resultCharacterBudget ?? 200_000;

  const toolContext = {
    ...options,
    onPersistenceFailure: () => {
      trackingUnavailable = true;
      options.onPersistenceFailure();
    },
    canRecord: () => proposedCalls <= 12,
    canExecute: () =>
      !trackingUnavailable &&
      !options.isHandoffCommitted?.() &&
      ++executedCalls <= 6,
    consumeResultCharacters: (characters: number) => {
      if (characters > resultCharactersRemaining) return false;

      resultCharactersRemaining -= characters;

      return true;
    },
  };

  return new ToolLoopAgent({
    model: getTextModel(),
    instructions: customerServicePrompt,
    tools: {
      ...(options.handoffScope
        ? {
            requestHumanHandoff: createRequestHumanHandoffTool({
              ...toolContext,
              handoffScope: options.handoffScope,
            }),
          }
        : {}),
      getBusinessInformation: createGetBusinessInformationTool(toolContext),
      searchPublicCatalog: createSearchPublicCatalogTool(toolContext),
      getPublicCatalogItem: createGetPublicCatalogItemTool(toolContext),
      ...(options.draftScope
        ? createBookingDraftTools({
            ...toolContext,
            draftScope: options.draftScope,
          })
        : {}),
      ...(options.customerScope
        ? {
            getMyProposal: createGetMyProposalTool({
              ...toolContext,
              proposalScope: options.customerScope,
            }),
            getMySentQuotation: createGetMySentQuotationTool({
              ...toolContext,
              customerScope: options.customerScope,
            }),
            getMyRequestHistory: createGetMyRequestHistoryTool({
              ...toolContext,
              customerScope: options.customerScope,
            }),
          }
        : {}),
      ...(options.memoryScope
        ? {
            updateConversationMemory: createUpdateConversationMemoryTool({
              ...toolContext,
              memoryScope: options.memoryScope,
            }),
          }
        : {}),
    },
    stopWhen: [isStepCount(4), () => options.isHandoffCommitted?.() ?? false],
    // Reserve the fourth generation for an answer using the available evidence.
    prepareStep: ({ stepNumber }) =>
      stepNumber >= 3 ? { toolChoice: "none" } : {},
    toolCallConcurrency: 1,
    onLanguageModelCallEnd: ({ content }) => {
      proposedCalls += content.filter(
        (part) => part.type === "tool-call",
      ).length;
      // Reject an oversized provider response before any tools from it execute.
      // At most six operations execute across all tools.
    },
    maxRetries: 0,
    maxOutputTokens: 800,
    reasoning: "none",
  });
}
