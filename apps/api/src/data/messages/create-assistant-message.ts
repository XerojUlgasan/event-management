import { sql, type Kysely } from "kysely";
import {
  assertGuestActive,
  guestExpiry,
} from "../guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";
import { linkToolCallsToReplyData } from "../ai/link-tool-calls-to-reply.js";

export function createAssistantMessageData(
  db: Kysely<DB>,
  conversationId: string,
  customerId: string | null,
  body: string,
  aiVersion: number,
  guestIdentityId?: string,
  toolTurn?: { turnId: string; customerMessageId: string },
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
    if (!owned || conversation.status !== "active")
      throw new Error("Conversation is unavailable");
    if (conversation.guest_identity_id) assertGuestActive(conversation);
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
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (toolTurn)
      await linkToolCallsToReplyData(trx, {
        ...toolTurn,
        assistantMessageId: message.id,
      });
    await trx
      .updateTable("conversations")
      .set({
        updated_at: message.created_at,
        ...(conversation.guest_identity_id
          ? { guest_expires_at: guestExpiry(message.created_at) }
          : {}),
      })
      .where("id", "=", conversationId)
      .execute();
    return { ...message, sender_display_name: null, sender_email: null };
  });
}
