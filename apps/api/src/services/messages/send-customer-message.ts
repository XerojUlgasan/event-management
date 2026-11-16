import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto } from "./message-response.js";
import { runAssistantTurnService } from "../ai/run-assistant-turn.js";

export async function sendCustomerMessageService(
  db: Kysely<DB>,
  customerId: string,
  body: string,
  conversationId?: string,
  abortSignal?: AbortSignal,
) {
  const conversation = conversationId
    ? await findConversationData(db, conversationId)
    : await ensureConversationData(db, customerId);
  if (!conversation || conversation.customer_id !== customerId) {
    throw new Error("Conversation not found");
  }

  // The message and AI state snapshot share a lock with admin takeover.
  // General conversations reopen here without resetting their AI preference.
  const saved = await createMessageData(
    db,
    conversation.id,
    customerId,
    "customer",
    body,
  );
  const message = messageDto(saved.message);
  if (!saved.aiEnabled)
    return { message, assistantMessage: null, assistantError: null };
  const started = Date.now();
  try {
    const assistantMessage = await runAssistantTurnService({
      db,
      customerId,
      conversationId: conversation.id,
      customerMessageId: message.id,
      aiVersion: saved.aiVersion,
      abortSignal,
    });
    return { message, assistantMessage, assistantError: null };
  } catch {
    const current = await findConversationData(db, conversation.id).catch(
      () => undefined,
    );
    if (
      current &&
      (!current.ai_enabled || current.ai_version !== saved.aiVersion)
    )
      return { message, assistantMessage: null, assistantError: null };
    // The customer write already committed. Do not invite a duplicate resend.
    console.warn("assistant-turn", {
      messageId: message.id,
      modelRole: "text",
      outcome: "unavailable",
      durationMs: Date.now() - started,
    });
    return {
      message,
      assistantMessage: null,
      assistantError:
        "Your message was saved, but the AI reply is unavailable. You do not need to resend your message.",
    };
  }
}
