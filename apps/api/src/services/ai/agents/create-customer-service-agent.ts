import { NoObjectGeneratedError, Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import type { AgentSettings } from "@event-management/contracts/ai-agent-settings";
import {
  MAX_SUGGESTED_REPLIES,
  type CatalogRecommendation,
} from "@event-management/contracts/messages";
import { createRequestHumanHandoffTool } from "../tools/request-human-handoff.js";
import { getTextModel } from "../models.js";
import { buildCustomerServicePrompt } from "../prompts/customer-service-prompt.js";
import { createSearchPublicCatalogTool } from "../tools/search-public-catalog.js";
import { createSearchSupportingDocumentsTool } from "../tools/search-supporting-documents.js";
import { createGetBusinessInformationTool } from "../tools/get-business-information.js";
import { createGetPublicCatalogItemTool } from "../tools/get-public-catalog-item.js";
import { createAttachCatalogRecommendationsTool } from "../tools/attach-catalog-recommendations.js";
import { createGetMyPackageTool } from "../tools/get-my-package.js";
import {
  createGetBookingDetailsTool,
  createGetLatestQuotationTool,
} from "../tools/get-my-booking-facts.js";
import { createUpdateConversationMemoryTool } from "../tools/update-conversation-memory.js";
import type { AssistantToolContext } from "../tools/assistant-tool-context.js";
import { createBookingDraftTools } from "../tools/booking-draft.js";

const maxStepTokens = 800;

const suggestedReplyInstructions = `## Suggested customer replies
- Use native tools for actions and lookups, then return a single JSON object with exactly two keys: "message" for the complete AMAC message and "suggested_replies" for an array of up to ${MAX_SUGGESTED_REPLIES} customer message strings. Write JSON only for the final answer, without a code fence or introductory text.
- Offer short, distinct messages in the customer's conversation language when the reply presents a concrete choice or a natural next question. Each suggestion is sent verbatim from the customer's perspective. Keep each suggestion to one line and at most 120 characters.
- Return an empty array for open-ended questions, personal details, or whenever free text fits better. Do not guess a person's details, invent options, or suggest agreeing to send or change a booking. Keep the AMAC message complete on its own.`;

export function containsRawToolProtocol(value: string) {
  return /(?:DSML|<\|(?:tool_call|tool_calls|function_call)|<tool_call>)/iu.test(
    value,
  );
}

const structuredReply = Output.object({
  schema: z.object({
    message: z.string().describe("The complete customer-facing AMAC reply."),
    suggested_replies: z
      .array(z.string())
      .max(MAX_SUGGESTED_REPLIES)
      .describe(
        "Short contextual replies the customer could send verbatim. Use [] when a free-text answer fits.",
      ),
  }),
});

const replyOutput = {
  ...structuredReply,
  // Provider JSON formatting can take precedence over automatic native tool
  // selection. Keep the normal tool loop and validate its final text here.
  responseFormat: Output.text().responseFormat,
  async parseCompleteOutput(
    ...[value, context]: Parameters<typeof structuredReply.parseCompleteOutput>
  ) {
    const text = value.text.trim();
    const fencedJson = /(?:^|\n)```(?:json)?\s*\n([\s\S]*?)\n```$/iu.exec(text);
    const trailingEnvelope =
      /(?:^|\n)(\{\s*"(?:message|suggested_replies)"\s*:[\s\S]*\})$/u.exec(
        text,
      );

    try {
      return await structuredReply.parseCompleteOutput(
        { text: fencedJson?.[1] ?? trailingEnvelope?.[1] ?? text },
        context,
      );
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;

      // Keep raw tool markup visible to the turn's guarded recovery path.
      if (containsRawToolProtocol(text))
        return { message: text, suggested_replies: [] };

      // Preserve a plain-text provider reply when it omitted suggestions.
      if (
        text &&
        !fencedJson &&
        !/^(?:\{|\[\s*(?:\]|\{|")|```)/u.test(text) &&
        !/"(?:message|suggested_replies)"\s*:/u.test(text)
      )
        return { message: text, suggested_replies: [] };

      // A completed tool can still supply a server-generated booking review.
      return null;
    }
  },
};

export function createCustomerServiceAgent({
  settings,
  answerOnlyAfter,
  onRecommendationsAttached,
  ...options
}: AssistantToolContext & {
  settings: AgentSettings;
  answerOnlyAfter: number;
  onRecommendationsAttached: (items: CatalogRecommendation[]) => void;
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
    instructions: `${buildCustomerServicePrompt(settings, {
      catalogRecommendations: true,
    })}\n\n${suggestedReplyInstructions}`,
    output: replyOutput,
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
            attachCatalogRecommendations:
              createAttachCatalogRecommendationsTool({
                ...toolContext,
                onRecommendationsAttached,
              }),
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
