import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listCatalogContextData } from "../../data/ai-chat/list-catalog-context.js";
import { buildSystemPrompt } from "./build-system-prompt.js";
import {
  callLLM,
  type ChatMessage,
  LLMNotConfiguredError,
  LLMError,
} from "./llm-client.js";
import { listThreadMessagesData } from "../../data/messages/list-thread-messages.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { messageDto } from "../messages/message-response.js";
import { AI_CHAT_HISTORY_LIMIT } from "@event-management/contracts/limits/ai-chat";

/** The virtual sender ID used for AI-generated messages (a stable nil UUID). */
export const AI_SENDER_ID = "00000000-0000-0000-0000-000000000000";

export type AiChatResult = {
  userMessage: ReturnType<typeof messageDto>;
  assistantMessage: ReturnType<typeof messageDto>;
};

export type AiChatError =
  | { kind: "conversation-not-found" }
  | { kind: "conversation-closed" }
  | { kind: "ai-not-configured" }
  | { kind: "ai-error"; status: number; message: string };

// --- Public (stateless) chat ---

export type PublicAiChatResult = {
  reply: string;
  showBookCta: boolean;
};

export type PublicAiChatError =
  | { kind: "ai-not-configured" }
  | { kind: "ai-error"; status: number; message: string };

/** Phrases that indicate the visitor is interested in booking or pricing. */
const BOOKING_INTENT_PATTERNS = [
  /\bbook\b/i,
  /\bbooking\b/i,
  /\bhow (do|can|to) (i|we|you) book\b/i,
  /\bprice\b/i,
  /\bpric(ed?|ing)\b/i,
  /\bhow much\b/i,
  /\bcost\b/i,
  /\bquot(e|ation)\b/i,
  /\bpackage\b/i,
  /\bavailab(le|ility)\b/i,
  /\breserv(e|ation)\b/i,
  /\bschedul(e|ing)\b/i,
  /\bevent\b/i,
  /\bwedding\b/i,
  /\bbirthday\b/i,
  /\bcelebrat(e|ion)\b/i,
  /\bparty\b/i,
  /\bgath(er|ering)\b/i,
  /\binterest(ed)?\b/i,
  /\bsign up\b/i,
  /\bget started\b/i,
];

function detectsBookingIntent(userMessage: string, reply: string): boolean {
  const combined = `${userMessage} ${reply}`;
  return BOOKING_INTENT_PATTERNS.some((p) => p.test(combined));
}

/**
 * Stateless AI chat for unsigned-in visitors.
 * Loads live catalog context, builds the system prompt, includes
 * any client-supplied history, and calls Gemini. No DB persistence.
 */
export async function publicAiChatService(
  db: Kysely<DB>,
  userText: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<PublicAiChatResult | PublicAiChatError> {
  const catalog = await listCatalogContextData(db);
  const systemPrompt = buildSystemPrompt(catalog);

  const historyMessages: ChatMessage[] = (history ?? []).map((h) => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content,
  }));

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userText },
  ];

  let replyText: string;
  try {
    replyText = await callLLM(messages);
  } catch (err) {
    if (err instanceof LLMNotConfiguredError) {
      return { kind: "ai-not-configured" };
    }
    if (err instanceof LLMError) {
      return { kind: "ai-error", status: err.status, message: err.message };
    }
    throw err;
  }

  return {
    reply: replyText,
    showBookCta: detectsBookingIntent(userText, replyText),
  };
}

/**
 * Processes one customer chat turn:
 * 1. Persist the customer's message.
 * 2. Load the last N thread messages as history.
 * 3. Build the system prompt from live catalog data.
 * 4. Call the LLM API.
 * 5. Persist the AI reply as an "admin"-role message attributed to AI_SENDER_ID.
 * 6. Return both messages as DTOs.
 */
export async function aiChatService(
  db: Kysely<DB>,
  customerId: string,
  userText: string,
  conversationId?: string,
): Promise<AiChatResult | AiChatError> {
  // --- 1. Resolve conversation ---
  const conversation = conversationId
    ? await findConversationData(db, conversationId)
    : await ensureConversationData(db, customerId);

  if (!conversation || conversation.customer_id !== customerId) {
    return { kind: "conversation-not-found" };
  }

  // Only booking-linked closed threads are blocked; general conversations stay usable.
  if (conversation.status === "closed" && conversation.booking_request_id) {
    return { kind: "conversation-closed" };
  }

  // --- 2. Persist the customer message ---
  const customerRow = await createMessageData(
    db,
    conversation,
    customerId,
    "customer",
    userText,
  );
  const userMessage = messageDto(customerRow);

  // --- 3. Load recent history (before the message we just inserted) ---
  const historyRows = await listThreadMessagesData(
    db,
    conversation.id,
    AI_CHAT_HISTORY_LIMIT,
    { createdAt: customerRow.created_at.toISOString(), id: customerRow.id },
  );

  // --- 4. Build messages array for OpenAI ---
  const catalog = await listCatalogContextData(db);
  const systemPrompt = buildSystemPrompt(catalog);

  // History is returned newest-first; reverse so the LLM sees it chronologically.
  const history: ChatMessage[] = historyRows.reverse().map((row) => ({
    role: row.sender_role === "admin" ? "assistant" : "user",
    content: row.body,
  }));

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
  ];

  // --- 5. Call OpenAI ---
  let replyText: string;
  try {
    replyText = await callLLM(messages);
  } catch (err) {
    if (err instanceof LLMNotConfiguredError) {
      return { kind: "ai-not-configured" };
    }
    if (err instanceof LLMError) {
      return { kind: "ai-error", status: err.status, message: err.message };
    }
    throw err;
  }

  // --- 6. Persist the AI reply ---
  const aiRow = await createMessageData(
    db,
    conversation,
    AI_SENDER_ID,
    "admin",
    replyText,
  );
  const assistantMessage = messageDto(aiRow);

  return { userMessage, assistantMessage };
}
