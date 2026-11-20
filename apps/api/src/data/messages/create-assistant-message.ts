import { withConversationActivity } from "../guest-chat/activity.js";
import {
  assertImageMessageJobLeaseData,
  type ImageMessageJobLease,
} from "./message-processing.js";
import { sql, type Kysely } from "kysely";
import { assertGuestActive } from "../guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";
import { linkToolCallsToReplyData } from "../ai/link-tool-calls-to-reply.js";
import { publishConversationMessageData } from "./publish-conversation-message.js";

export function createAssistantMessageData(
  db: Kysely<DB>,
  conversationId: string,
  customerId: string | null,
  body: string,
  aiVersion: number,
  guestIdentityId?: string,
  toolTurn?: { turnId: string; customerMessageId: string },
  jobLease?: ImageMessageJobLease,
  abortSignal?: AbortSignal,
) {
  return db.transaction().execute(async (trx) => {
    const conversation = await trx
      .selectFrom("conversations")
      .selectAll()
      .where("id", "=", conversationId)
      .forUpdate()
      .executeTakeFirst();
    const owned =
      conversation &&
      (guestIdentityId
        ? conversation.guest_identity_id === guestIdentityId ||
          conversation.claimed_guest_identity_id === guestIdentityId
        : conversation.customer_id === customerId && customerId !== null);

    if (!owned) throw new Error("Conversation is unavailable");

    if (conversation.guest_identity_id)
      assertGuestActive(await withConversationActivity(trx, conversation));

    if (jobLease)
      await assertImageMessageJobLeaseData(trx, jobLease, abortSignal);

    abortSignal?.throwIfAborted();

    if (toolTurn) {
      const previous = await trx
        .selectFrom("messages")
        .selectAll()
        .where("reply_to_message_id", "=", toolTurn.customerMessageId)
        .where("conversation_id", "=", conversationId)
        .executeTakeFirst();

      if (previous)
        return { ...previous, sender_display_name: null, sender_email: null };
    }

    if (!conversation.ai_enabled || conversation.ai_version !== aiVersion)
      return null;

    const message = await trx
      .insertInto("messages")
      .values({
        conversation_id: conversationId,
        created_at: sql<Date>`clock_timestamp()`,
        sender_id: null,
        sender_role: "assistant",
        body,
        reply_to_message_id: toolTurn?.customerMessageId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (toolTurn)
      await trx
        .updateTable("guest_message_requests")
        .set({
          assistant_message_id: message.id,
          assistant_error: null,
          completed: true,
        })
        .where("message_id", "=", toolTurn.customerMessageId)
        .execute();

    if (toolTurn)
      await linkToolCallsToReplyData(trx, {
        ...toolTurn,
        assistantMessageId: message.id,
      });

    await trx
      .updateTable("conversations")
      .set({
        updated_at: message.created_at,
      })
      .where("id", "=", conversationId)
      .execute();

    if (conversation.customer_id)
      await publishConversationMessageData(trx, conversation.id, message.id);

    return { ...message, sender_display_name: null, sender_email: null };
  });
}
