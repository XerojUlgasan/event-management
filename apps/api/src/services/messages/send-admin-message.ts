import { serializeMessageRequest } from "./serialize-message-request.js";
import {
  prepareMessageImages,
  cleanupMessageImages,
  type CheckedMessageImage,
} from "./prepare-message-images.js";
import type { AiHandoff } from "@event-management/contracts/ai-handoff";
import type { Kysely } from "kysely";
import { GuestChatError } from "../../data/guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto, type MessageDto } from "./message-response.js";

export type SendAdminMessageResult =
  | {
      kind: "ok";
      message: MessageDto;
      aiEnabled: boolean;
      aiVersion: number;
      aiHandoff: AiHandoff | null;
    }
  | { kind: "not-found" }
  | { kind: "expired" };

async function performSend(
  db: Kysely<DB>,
  id: string,
  senderId: string,
  body: string,
  requestId?: string,
  imageFiles: CheckedMessageImage[] = [],
  abortSignal?: AbortSignal,
): Promise<SendAdminMessageResult> {
  const conversation = await findConversationData(db, id);

  if (!conversation) return { kind: "not-found" };

  let images: Awaited<ReturnType<typeof prepareMessageImages>> = [];

  try {
    const replay = await createMessageData(
      db,
      id,
      senderId,
      "admin",
      body,
      requestId,
      [],
      imageFiles.map((image) => image.contentHash),
      true,
    );

    images = replay
      ? []
      : await prepareMessageImages(id, imageFiles, abortSignal);
    const saved =
      replay ??
      (await createMessageData(
        db,
        conversation.id,
        senderId,
        "admin",
        body,
        requestId,
        images,
      ));

    if (!saved) throw new Error("Message persistence failed");

    if (saved.replayed && images.length) await cleanupMessageImages(images);

    return {
      kind: "ok",
      message: messageDto(saved.message),
      aiEnabled: saved.aiEnabled,
      aiVersion: saved.aiVersion,
      aiHandoff: saved.aiHandoff,
    };
  } catch (error) {
    await cleanupMessageImages(images);

    if (error instanceof GuestChatError) return { kind: "expired" };

    if (error instanceof Error && error.message === "Conversation not found")
      return { kind: "not-found" };

    throw error;
  }
}

export function sendAdminMessageService(
  ...args: Parameters<typeof performSend>
) {
  return serializeMessageRequest(args[4], () => performSend(...args));
}
