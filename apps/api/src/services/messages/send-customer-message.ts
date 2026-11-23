import { serializeMessageRequest } from "./serialize-message-request.js";
import {
  prepareMessageImages,
  cleanupMessageImages,
  type CheckedMessageImage,
} from "./prepare-message-images.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { selectMessageColumnsData } from "../../data/messages/select-message-columns.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto } from "./message-response.js";
import { runAssistantTurnService } from "../ai/run-assistant-turn.js";
import { waitForEarlierImages } from "./wait-for-earlier-images.js";

export async function sendCustomerMessageService(
  db: Kysely<DB>,
  customerId: string,
  body: string,
  conversationId?: string,
  abortSignal?: AbortSignal,
  requestId?: string,
  imageFiles: CheckedMessageImage[] = [],
  reviewMessageId?: string,
) {
  // Serialize replies to a pinned assistant message within this worker.
  // The database guard and unique reply protect the commit across workers.
  if (requestId && reviewMessageId && !imageFiles.length) {
    return serializeMessageRequest(`confirmation:${requestId}`, () =>
      sendCustomerMessageUnlocked(
        db,
        customerId,
        body,
        conversationId,
        abortSignal,
        requestId,
        imageFiles,
        reviewMessageId,
      ),
    );
  }

  return sendCustomerMessageUnlocked(
    db,
    customerId,
    body,
    conversationId,
    abortSignal,
    requestId,
    imageFiles,
    reviewMessageId,
  );
}

async function sendCustomerMessageUnlocked(
  db: Kysely<DB>,
  customerId: string,
  body: string,
  conversationId?: string,
  abortSignal?: AbortSignal,
  requestId?: string,
  imageFiles: CheckedMessageImage[] = [],
  reviewMessageId?: string,
) {
  const conversation = conversationId
    ? await findConversationData(db, conversationId)
    : await ensureConversationData(db, customerId);

  if (!conversation || conversation.customer_id !== customerId) {
    throw new Error("Conversation not found");
  }

  // The message and AI state snapshot share a lock with admin takeover.
  // General conversations reopen here without resetting their AI preference.
  const saved = await serializeMessageRequest(requestId, async () => {
    const replay = await createMessageData(
      db,
      conversation.id,
      customerId,
      "customer",
      body,
      requestId,
      [],
      imageFiles.map((image) => image.contentHash),
      true,
    );

    const images = replay
      ? []
      : await prepareMessageImages(conversation.id, imageFiles, abortSignal);
    let saved;

    try {
      saved =
        replay ??
        (await createMessageData(
          db,
          conversation.id,
          customerId,
          "customer",
          body,
          requestId,
          images,
          undefined,
          false,
        ));

      if (!saved) throw new Error("Message persistence failed");
    } catch (error) {
      await cleanupMessageImages(images);
      throw error;
    }

    if (saved.replayed && images.length) await cleanupMessageImages(images);

    return saved;
  });

  const message = messageDto(saved.message);

  if (saved.replayed && reviewMessageId) {
    const reply = await selectMessageColumnsData(db, conversation.id)
      .where("m.reply_to_message_id", "=", message.id)
      .where("m.sender_role", "=", "assistant")
      .executeTakeFirst();

    if (reply)
      return {
        message,
        assistantMessage: messageDto(reply),
        assistantError: null,
      };
  }

  if (
    (saved.replayed && !reviewMessageId) ||
    !saved.aiEnabled ||
    imageFiles.length
  )
    return { message, assistantMessage: null, assistantError: null };

  try {
    await waitForEarlierImages(db, conversation.id, message.id, abortSignal);
    const assistantMessage = await runAssistantTurnService({
      db,
      customerId,
      conversationId: conversation.id,
      customerMessageId: message.id,
      aiVersion: saved.aiVersion,
      reviewMessageId,
      replayed: saved.replayed,
      abortSignal,
    });

    return { message, assistantMessage, assistantError: null };
  } catch {
    // A competing worker may have committed the same receipt while this turn
    // was running. Return it even if this execution lost the guarded race.
    if (reviewMessageId) {
      const reply = await selectMessageColumnsData(db, conversation.id)
        .where("m.reply_to_message_id", "=", message.id)
        .where("m.sender_role", "=", "assistant")
        .executeTakeFirst();

      if (reply)
        return {
          message,
          assistantMessage: messageDto(reply),
          assistantError: null,
        };
    }

    const current = await findConversationData(db, conversation.id).catch(
      () => undefined,
    );

    if (
      current &&
      (!current.ai_enabled || current.ai_version !== saved.aiVersion)
    )
      return { message, assistantMessage: null, assistantError: null };

    console.warn("assistant-turn", {
      messageId: message.id,
      modelRole: "text",
      outcome: "unavailable",
    });

    return {
      message,
      assistantMessage: null,
      assistantError:
        "Your message was saved, but the AI reply is unavailable. You do not need to resend your message.",
    };
  }
}
