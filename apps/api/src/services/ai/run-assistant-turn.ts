import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import type { Kysely } from "kysely";
import { assertGuestActive } from "../../data/guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { listConversationHistoryData } from "../../data/messages/list-conversation-history.js";
import { createAssistantMessageData } from "../../data/messages/create-assistant-message.js";
import { messageDto } from "../messages/message-response.js";
import {
  buildAssistantContext,
  buildPreviousCatalogSearchContext,
  buildPreviousCatalogItemContext,
} from "./assistant-context.js";
import { createCustomerServiceAgent } from "./agents/create-customer-service-agent.js";

export async function runAssistantTurnService({
  db,
  customerId,
  conversationId,
  customerMessageId,
  aiVersion,
  guestIdentityId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string | null;
  conversationId: string;
  customerMessageId: string;
  aiVersion: number;
  guestIdentityId?: string;
  abortSignal?: AbortSignal;
}) {
  const started = Date.now();
  abortSignal?.throwIfAborted();
  const conversation = await findConversationData(db, conversationId);
  const owned =
    conversation &&
    (guestIdentityId
      ? conversation.guest_identity_id === guestIdentityId ||
        conversation.claimed_guest_identity_id === guestIdentityId
      : conversation.customer_id === customerId && customerId !== null);
  if (!owned) throw new Error("Conversation not found");
  if (conversation.guest_identity_id) assertGuestActive(conversation);
  if (conversation.status !== "active")
    throw new Error("Conversation is closed");
  if (!conversation.ai_enabled || conversation.ai_version !== aiVersion)
    return null;
  const history = await listConversationHistoryData(
    db,
    conversationId,
    customerMessageId,
  );
  if (history.at(-1)?.id !== customerMessageId)
    throw new Error("Customer message not found");
  const previousCatalogSearch = await buildPreviousCatalogSearchContext({
    db,
    conversationId,
    customerMessageId,
  });
  const previousCatalogItem = await buildPreviousCatalogItemContext({
    db,
    conversationId,
    customerMessageId,
  });
  const context = JSON.stringify({
    ...(guestIdentityId
      ? {
          currentDateTime: new Date().toISOString(),
          timeZone: "Asia/Manila",
          bookingRequest: null,
        }
      : await buildAssistantContext({
          db,
          customerId: customerId!,
          bookingRequestId: conversation.booking_request_id,
        })),
    ...(previousCatalogSearch ? { previousCatalogSearch } : {}),
    ...(previousCatalogItem ? { previousCatalogItem } : {}),
  });
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
  const turnId = randomUUID();
  let persistenceFailed = false;
  const agent = createCustomerServiceAgent({
    db,
    customerMessageId,
    turnId,
    onPersistenceFailure: () => {
      persistenceFailed = true;
    },
    assertActive: async () => {
      const current = await findConversationData(db, conversationId);
      const stillOwned =
        current &&
        (guestIdentityId
          ? current.guest_identity_id === guestIdentityId ||
            current.claimed_guest_identity_id === guestIdentityId
          : current.customer_id === customerId && customerId !== null);
      if (
        !stillOwned ||
        current.status !== "active" ||
        !current.ai_enabled ||
        current.ai_version !== aiVersion
      )
        throw new Error("Assistant turn is no longer active");
      if (current.guest_identity_id) assertGuestActive(current);
    },
  });
  const deadline = AbortSignal.timeout(30_000);
  const signal = abortSignal
    ? AbortSignal.any([abortSignal, deadline])
    : deadline;
  const { text, usage, steps } = await agent.generate({
    messages,
    abortSignal: signal,
  });
  if (persistenceFailed) throw new Error("Tool-call tracking is unavailable");
  const reply = text.trim();
  if (!reply) throw new Error("AI returned an empty reply");
  signal.throwIfAborted();
  const saved = await createAssistantMessageData(
    db,
    conversationId,
    customerId,
    reply,
    aiVersion,
    guestIdentityId,
    { turnId, customerMessageId },
  );
  if (!saved) return null;
  const message = messageDto(saved);
  console.info("assistant-turn", {
    messageId: customerMessageId,
    modelRole: "text",
    outcome: "replied",
    durationMs: Date.now() - started,
    steps: steps.length,
    toolCalls: steps.reduce((count, step) => count + step.toolCalls.length, 0),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return message;
}
