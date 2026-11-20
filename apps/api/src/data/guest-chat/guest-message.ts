import { enqueueImageMessageProcessingData } from "../messages/message-processing.js";
import {
  insertMessageImagesData,
  matchingMessageImagesData,
  type SavedMessageImage,
} from "../messages/message-images.js";
import { sql } from "kysely";
import type { GuestDatabase } from "./guest-conversation.js";
import { GUEST_CUSTOMER_MESSAGE_LIMIT } from "@event-management/contracts/guest-chat";
import { GuestChatError, lockGuestConversation } from "./guest-conversation.js";
import { selectMessageColumnsData } from "../messages/select-message-columns.js";

export async function saveGuestMessageData(
  db: GuestDatabase,
  id: string,
  token: string | undefined,
  body: string,
  requestId: string,
  images: SavedMessageImage[] = [],
  imageHashes = images.map((image) => image.content_hash),
  preflight = false,
) {
  return db.transaction().execute(async (trx) => {
    const conversation = await lockGuestConversation(trx, id, token);
    const previous = await trx
      .selectFrom("guest_message_requests")
      .selectAll()
      .where("conversation_id", "=", id)
      .where("request_id", "=", requestId)
      .executeTakeFirst();

    if (previous) {
      const message = await selectMessageColumnsData(trx, id)
        .where("m.id", "=", previous.message_id)
        .executeTakeFirstOrThrow();

      if (
        message.body !== body ||
        !(await matchingMessageImagesData(trx, message.id, imageHashes))
      )
        throw new GuestChatError(
          409,
          "Request ID was already used for a different message",
          "request_conflict",
        );

      const assistantMessage = previous.assistant_message_id
        ? await selectMessageColumnsData(trx, id)
            .where("m.id", "=", previous.assistant_message_id)
            .executeTakeFirstOrThrow()
        : null;

      return {
        conversation,
        message,
        assistantMessage,
        assistantError: previous.assistant_error,
        replay: true as const,
      };
    }

    const foreignRequest = await trx
      .selectFrom("messages")
      .select("id")
      .where("id", "=", requestId)
      .executeTakeFirst();

    if (foreignRequest)
      throw new GuestChatError(
        409,
        "Request ID was already used for a different message",
        "request_conflict",
      );

    if (
      conversation.guest_customer_message_count >= GUEST_CUSTOMER_MESSAGE_LIMIT
    )
      throw new GuestChatError(
        409,
        "Sign in to continue this conversation",
        "login_required",
      );

    if (preflight) return null;

    const message = await trx
      .insertInto("messages")
      .values({
        id: requestId,
        conversation_id: id,
        sender_id: null,
        sender_role: "customer",
        guest_origin: true,
        body,
        created_at: sql<Date>`clock_timestamp()`,
      })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .returningAll()
      .executeTakeFirst();

    if (!message)
      throw new GuestChatError(
        409,
        "Request ID was already used for a different message",
        "request_conflict",
      );

    await insertMessageImagesData(trx, message.id, id, images);
    const processing = await enqueueImageMessageProcessingData(
      trx,
      message.id,
      conversation,
      "customer",
      images.length > 0,
    );
    const updated = await trx
      .updateTable("conversations")
      .set({
        updated_at: message.created_at,
        guest_customer_message_count:
          conversation.guest_customer_message_count + 1,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    // The reservation commits with the message before any provider request. A replay
    // never invokes the provider again, even if the first worker was interrupted.
    await trx
      .insertInto("guest_message_requests")
      .values({
        conversation_id: id,
        request_id: requestId,
        message_id: message.id,
        completed: !conversation.ai_enabled,
      })
      .execute();

    return {
      conversation: { ...updated, last_activity_at: message.created_at },
      message: {
        ...message,
        images,
        processing,
        sender_display_name: null,
        sender_email: null,
      },
      assistantMessage: null,
      assistantError: null,
      replay: false as const,
    };
  });
}

export async function completeGuestMessageData(
  db: GuestDatabase,
  id: string,
  requestId: string,
  assistantMessageId: string | null,
  assistantError: string | null,
) {
  await db.transaction().execute(async (trx) => {
    await trx
      .selectFrom("conversations")
      .select("id")
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("guest_message_requests")
      .set({
        assistant_message_id: assistantMessageId,
        assistant_error: assistantError,
        completed: true,
      })
      .where("conversation_id", "=", id)
      .where("request_id", "=", requestId)
      .execute();
  });
}
