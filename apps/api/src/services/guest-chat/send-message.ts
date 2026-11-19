import { serializeMessageRequest } from "../messages/serialize-message-request.js";
import {
  prepareMessageImages,
  cleanupMessageImages,
  type CheckedMessageImage,
} from "../messages/prepare-message-images.js";
import type { GuestDatabase } from "../../data/guest-chat/guest-conversation.js";
import { guestStatus } from "../../data/guest-chat/guest-conversation.js";
import {
  saveGuestMessageData,
  completeGuestMessageData,
} from "../../data/guest-chat/guest-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { messageDto } from "../messages/message-response.js";
import { runAssistantTurnService } from "../ai/run-assistant-turn.js";
import { waitForEarlierImages } from "../messages/wait-for-earlier-images.js";

export async function sendGuestMessageService(
  db: GuestDatabase,
  id: string,
  token: string | undefined,
  body: string,
  requestId: string,
  abortSignal?: AbortSignal,
  imageFiles: CheckedMessageImage[] = [],
) {
  const saved = await serializeMessageRequest(`guest:${id}`, async () => {
    const replay = await saveGuestMessageData(
      db,
      id,
      token,
      body,
      requestId,
      [],
      imageFiles.map((image) => image.contentHash),
      true,
    );

    const images = replay
      ? []
      : await prepareMessageImages(id, imageFiles, abortSignal);
    let saved;

    try {
      saved =
        replay ??
        (await saveGuestMessageData(db, id, token, body, requestId, images));

      if (!saved) throw new Error("Message persistence failed");
    } catch (error) {
      await cleanupMessageImages(images);
      throw error;
    }

    if (saved.replay && images.length) await cleanupMessageImages(images);

    return saved;
  });

  const message = messageDto(saved.message);
  let assistantMessage = saved.assistantMessage
    ? messageDto(saved.assistantMessage)
    : null;
  let assistantError = saved.assistantError;

  if (!saved.replay && saved.conversation.ai_enabled && !imageFiles.length) {
    try {
      await waitForEarlierImages(db, id, message.id, abortSignal);
      assistantMessage = await runAssistantTurnService({
        db,
        customerId: null,
        guestIdentityId: saved.conversation.guest_identity_id!,
        conversationId: id,
        customerMessageId: message.id,
        aiVersion: saved.conversation.ai_version,
        abortSignal,
      });
    } catch {
      const current = await findConversationData(db, id);

      if (
        current?.ai_enabled &&
        current.ai_version === saved.conversation.ai_version
      ) {
        assistantError =
          "Your message was saved, but the AI reply is unavailable. You do not need to resend your message.";
        console.warn("assistant-turn", {
          messageId: message.id,
          modelRole: "text",
          outcome: "unavailable",
        });
      }
    }

    await completeGuestMessageData(
      db,
      id,
      requestId,
      assistantMessage?.id ?? null,
      assistantError,
    );
  }

  const current = await findConversationData(db, id);

  // Claim may race this response; expose only the already-authorized saved turn.
  return {
    message,
    assistantMessage,
    assistantError,
    guest: guestStatus(
      current?.guest_expires_at ? current : saved.conversation,
    ),
  };
}
