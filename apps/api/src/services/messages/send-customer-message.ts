import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";
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

  // General conversations can reopen, but closed booking threads remain closed.
  if (conversation.status === "closed") {
    if (conversation.booking_request_id)
      throw new Error("Conversation is closed");
    await updateConversationData(db, conversation.id, {
      status: "active",
      closed_at: null,
    });
  }

  const message = messageDto(
    await createMessageData(db, conversation, customerId, "customer", body),
  );
  const started = Date.now();
  try {
    const assistantMessage = await runAssistantTurnService({
      db,
      customerId,
      conversationId: conversation.id,
      customerMessageId: message.id,
      abortSignal,
    });
    return { message, assistantMessage, assistantError: null };
  } catch {
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
