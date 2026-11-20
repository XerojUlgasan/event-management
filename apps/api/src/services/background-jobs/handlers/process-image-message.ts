import {
  assertGuestActive,
  guestExpiry,
} from "../../../data/guest-chat/guest-conversation.js";
import { MessageProcessingError } from "../../messages/message-processing-error.js";
import { createHash, randomUUID } from "node:crypto";
import { type Kysely } from "kysely";
import { MAX_MESSAGE_IMAGE_PIXELS } from "@event-management/contracts/limits/messages";
import { messageImageInterpretationSchema } from "@event-management/contracts/message-images";
import type { DB } from "../../../db/types.js";
import {
  loadImageMessageJobData,
  saveMessageImageObservationData,
  hasLaterMessageReplyData,
  type ImageMessageJobLease,
  type ImageMessageJobPayload,
} from "../../../data/messages/message-processing.js";
import { findConversationData } from "../../../data/messages/find-conversation.js";
import { getCatalogMedia } from "../../../utils/catalog-media-storage.js";
import { createInterpretMessageImageTool } from "../../ai/tools/interpret-message-image.js";
import { runAssistantTurnService } from "../../ai/run-assistant-turn.js";

async function readImage(
  image: {
    id: string;
    storage_key: string;
    byte_size: number;
    content_hash: string;
  },
  signal: AbortSignal,
) {
  const stream = await getCatalogMedia(image.storage_key, undefined, signal);
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();

      if (part.done) break;

      size += part.value.length;

      if (size > image.byte_size)
        throw new MessageProcessingError("invalid_image");

      parts.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const bytes = Buffer.concat(parts);

  if (
    size !== image.byte_size ||
    createHash("sha256").update(bytes).digest("hex") !== image.content_hash
  )
    throw new MessageProcessingError("invalid_image");

  try {
    const { Image } = await import("imagescript");
    await Image.decode(bytes, { maxPixels: MAX_MESSAGE_IMAGE_PIXELS });
  } catch {
    throw new MessageProcessingError("invalid_image");
  }

  return bytes;
}

export async function processImageMessageJob(
  db: Kysely<DB>,
  payload: ImageMessageJobPayload,
  signal: AbortSignal,
  lease?: ImageMessageJobLease,
) {
  if (!lease) throw new Error("Message job requires its lease");

  const { message, conversation, images } = await loadImageMessageJobData(
    db,
    payload,
  );

  if (!images.length) throw new MessageProcessingError("invalid_payload");

  const guestIdentityId =
    message.guest_origin &&
    message.sender_role === "customer" &&
    message.sender_id === null
      ? (conversation.guest_identity_id ??
        conversation.claimed_guest_identity_id)
      : null;
  const customerId =
    !message.guest_origin && message.sender_role === "customer"
      ? message.sender_id
      : null;

  if (
    message.sender_role === "customer" &&
    !guestIdentityId &&
    (!customerId || customerId !== conversation.customer_id)
  )
    throw new MessageProcessingError("invalid_payload");

  if (
    !["customer", "admin"].includes(message.sender_role) ||
    (message.sender_role === "admin" && payload.aiVersion !== null)
  )
    throw new MessageProcessingError("invalid_payload");

  const initial = await findConversationData(db, payload.conversationId);

  if (initial?.guest_identity_id) {
    try {
      assertGuestActive(initial);
    } catch {
      return;
    }
  }

  const turnId = randomUUID();

  for (const image of images) {
    signal.throwIfAborted();

    if (image.interpretation !== null) continue;

    let bytes;

    try {
      bytes = await readImage(image, signal);
    } catch (error) {
      if (
        error instanceof MessageProcessingError &&
        error.code === "invalid_image"
      ) {
        throw error;
      }

      throw new MessageProcessingError("image_unavailable");
    }

    try {
      const imageTool = createInterpretMessageImageTool({
        db,
        sourceMessageId: payload.messageId,
        turnId,
        imageId: image.id,
        position: image.position,
        lease,
        image: {
          bytes,
          mimeType: image.mime_type,
          contentHash: image.content_hash,
        },
      });

      if (!imageTool.execute) throw new Error("Image tool cannot execute");

      const observation = messageImageInterpretationSchema.parse(
        await imageTool.execute(
          {},
          {
            toolCallId: image.id,
            messages: [],
            abortSignal: signal,
            context: {},
          },
        ),
      );
      await saveMessageImageObservationData(
        db,
        image.id,
        observation,
        lease,
        signal,
      );
    } catch {
      throw new MessageProcessingError("vision_unavailable");
    }
  }

  if (
    payload.aiVersion === null ||
    payload.suppressReply ||
    (await hasLaterMessageReplyData(db, payload))
  )
    return;

  try {
    await runAssistantTurnService({
      db,
      conversationId: payload.conversationId,
      customerId,
      guestIdentityId: guestIdentityId ?? undefined,
      customerMessageId: payload.messageId,
      aiVersion: payload.aiVersion,
      abortSignal: signal,
      jobLease: lease,
    });
  } catch {
    const current = await findConversationData(db, payload.conversationId);

    if (
      current &&
      (!current.ai_enabled ||
        current.ai_version !== payload.aiVersion ||
        (current.guest_identity_id &&
          Date.now() >= guestExpiry(current.last_activity_at).getTime()))
    ) {
      return;
    }

    throw new MessageProcessingError("reply_unavailable");
  }
}
