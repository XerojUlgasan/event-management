import { generateText, type ModelMessage } from "ai";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { listConversationHistoryData } from "../../data/messages/list-conversation-history.js";
import { createAssistantMessageData } from "../../data/messages/create-assistant-message.js";
import { messageDto } from "../messages/message-response.js";
import { getTextModel } from "./models.js";
import { buildAssistantContext } from "./assistant-context.js";
import { customerServicePrompt } from "./prompts/customer-service-prompt.js";

export async function runAssistantTurnService({
  db,
  customerId,
  conversationId,
  customerMessageId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
  customerMessageId: string;
  abortSignal?: AbortSignal;
}) {
  const started = Date.now();
  abortSignal?.throwIfAborted();
  const conversation = await findConversationData(db, conversationId);
  if (!conversation || conversation.customer_id !== customerId)
    throw new Error("Conversation not found");
  if (conversation.status !== "active")
    throw new Error("Conversation is closed");
  const history = await listConversationHistoryData(
    db,
    conversationId,
    customerMessageId,
  );
  if (history.at(-1)?.id !== customerMessageId)
    throw new Error("Customer message not found");
  const context = JSON.stringify(
    await buildAssistantContext({
      db,
      customerId,
      bookingRequestId: conversation.booking_request_id,
    }),
  );
  // Never silently discard older history. Reject an oversized context explicitly.
  if (
    history.reduce(
      (size, message) => size + message.body.length,
      context.length,
    ) > 200_000
  )
    throw new Error("Conversation is too long for an AI reply");
  const messages: ModelMessage[] = [
    { role: "user", content: context },
    ...history.map((message): ModelMessage => ({
      role: message.sender_role === "customer" ? "user" : "assistant",
      content:
        message.sender_role === "admin"
          ? `AMAC team: ${message.body}`
          : message.body,
    })),
  ];
  const { text, usage } = await generateText({
    model: getTextModel(),
    system: customerServicePrompt,
    messages,
    maxRetries: 0,
    maxOutputTokens: 800,
    reasoning: "none",
    timeout: 30_000,
    abortSignal,
  });
  const reply = text.trim();
  if (!reply) throw new Error("AI returned an empty reply");
  abortSignal?.throwIfAborted();
  const message = messageDto(
    await createAssistantMessageData(db, conversationId, customerId, reply),
  );
  console.info("assistant-turn", {
    messageId: customerMessageId,
    modelRole: "text",
    outcome: "replied",
    durationMs: Date.now() - started,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return message;
}
