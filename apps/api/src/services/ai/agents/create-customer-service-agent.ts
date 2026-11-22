import { ToolLoopAgent } from "ai";
import type { AgentSettings } from "@event-management/contracts/ai-agent-settings";
import { createRequestHumanHandoffTool } from "../tools/request-human-handoff.js";
import { getTextModel } from "../models.js";
import { buildCustomerServicePrompt } from "../prompts/customer-service-prompt.js";
import { createSearchPublicCatalogTool } from "../tools/search-public-catalog.js";
import { createSearchSupportingDocumentsTool } from "../tools/search-supporting-documents.js";
import { createGetBusinessInformationTool } from "../tools/get-business-information.js";
import { createGetPublicCatalogItemTool } from "../tools/get-public-catalog-item.js";
import { createGetMyPackageTool } from "../tools/get-my-package.js";
import {
  createGetBookingDetailsTool,
  createGetLatestQuotationTool,
} from "../tools/get-my-booking-facts.js";
import { createUpdateConversationMemoryTool } from "../tools/update-conversation-memory.js";
import type { AssistantToolContext } from "../tools/assistant-tool-context.js";
import { createBookingDraftTools } from "../tools/booking-draft.js";

const maxStepTokens = 800;

export function createCustomerServiceAgent({
  settings,
  answerOnlyAfter,
  ...options
}: AssistantToolContext & {
  settings: AgentSettings;
  answerOnlyAfter: number;
}) {
  let proposedBatchSize = 0;
  let trackingUnavailable = false;
  let remainingOutputTokens = 3_200;
  let stepTokenLimit = maxStepTokens;
  let answerOnly = false;
  let resultCharactersRemaining = options.resultCharacterBudget ?? 200_000;

  const toolContext = {
    ...options,
    onPersistenceFailure: () => {
      trackingUnavailable = true;
      options.onPersistenceFailure();
    },
    canRecord: () => proposedBatchSize <= 12,
    canExecute: () =>
      !answerOnly && !trackingUnavailable && !options.isHandoffCommitted?.(),
    consumeResultCharacters: (characters: number) => {
      if (characters > resultCharactersRemaining) return false;

      resultCharactersRemaining -= characters;

      return true;
    },
  };

  return new ToolLoopAgent({
    model: getTextModel(),
    instructions: buildCustomerServicePrompt(settings),
    tools: {
      searchSupportingDocuments:
        createSearchSupportingDocumentsTool(toolContext),
      ...(options.handoffScope
        ? {
            requestHumanHandoff: createRequestHumanHandoffTool({
              ...toolContext,
              handoffScope: options.handoffScope,
            }),
          }
        : {}),
      ...(settings.allowBusinessInformation
        ? {
            getBusinessInformation:
              createGetBusinessInformationTool(toolContext),
          }
        : {}),
      ...(settings.allowPublicCatalog
        ? {
            searchPublicCatalog: createSearchPublicCatalogTool(toolContext),
            getPublicCatalogItem: createGetPublicCatalogItemTool(toolContext),
          }
        : {}),
      ...(options.draftScope
        ? createBookingDraftTools({
            ...toolContext,
            draftScope: options.draftScope,
          })
        : {}),
      ...(options.customerScope
        ? {
            getMyPackage: createGetMyPackageTool({
              ...toolContext,
              proposalScope: options.customerScope,
            }),
            getLatestQuotation: createGetLatestQuotationTool({
              ...toolContext,
              customerScope: options.customerScope,
            }),
            getBookingDetails: createGetBookingDetailsTool({
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
    stopWhen: () =>
      answerOnly || trackingUnavailable || !!options.isHandoffCommitted?.(),
    prepareStep: () => {
      if (remainingOutputTokens <= 0)
        throw new Error("Assistant output budget exhausted");

      stepTokenLimit = Math.min(maxStepTokens, remainingOutputTokens);
      // Start another tool round only while a full answer can still fit.
      answerOnly =
        Date.now() >= answerOnlyAfter ||
        remainingOutputTokens < 2 * maxStepTokens;

      return {
        maxOutputTokens: stepTokenLimit,
        ...(answerOnly && { toolChoice: "none" as const }),
      };
    },
    toolCallConcurrency: 1,
    onLanguageModelCallEnd: ({ content, usage }) => {
      remainingOutputTokens -= usage.outputTokens ?? stepTokenLimit;
      // Reject an oversized provider batch before its tools can execute.
      proposedBatchSize = content.filter(
        (part) => part.type === "tool-call",
      ).length;
    },
    maxRetries: 0,
    reasoning: "none",
  });
}
