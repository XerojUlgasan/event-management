import type { GuestDatabase } from "../../data/guest-chat/guest-conversation.js";
import { guestStatus } from "../../data/guest-chat/guest-conversation.js";
import {
  saveGuestMessageData,
  completeGuestMessageData,
} from "../../data/guest-chat/guest-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { messageDto } from "../messages/message-response.js";
import { runAssistantTurnService } from "../ai/run-assistant-turn.js";

export async function sendGuestMessageService(
  db: GuestDatabase,
  id: string,
  token: string | undefined,
  body: string,
  requestId: string,
  abortSignal?: AbortSignal,
) {
  const saved = await saveGuestMessageData(db, id, token, body, requestId);
  const message = messageDto(saved.message);
  let assistantMessage = saved.assistantMessage
    ? messageDto(saved.assistantMessage)
    : null;
  let assistantError = saved.assistantError;

  if (!saved.replay && saved.conversation.ai_enabled) {
    try {
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

  // A concurrent authenticated claim can finish while the provider runs. The
  // response contains only this already-authorized guest turn, never new account data.
  return {
    message,
    assistantMessage,
    assistantError,
    guest: guestStatus(
      current?.guest_expires_at ? current : saved.conversation,
    ),
  };
}
