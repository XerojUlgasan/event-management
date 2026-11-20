import { withConversationActivity } from "../guest-chat/activity.js";
import {
  assertImageMessageJobLeaseData,
  type ImageMessageJobLease,
} from "./message-processing.js";
import { sql, type Kysely } from "kysely";
import type { AiHandoff } from "@event-management/contracts/ai-handoff";
import type { DB } from "../../db/types.js";
import { assertGuestActive } from "../guest-chat/guest-conversation.js";
import { finishToolCallData } from "../ai/finish-tool-call.js";
import { linkToolCallsToReplyData } from "../ai/link-tool-calls-to-reply.js";
import { publishConversationMessageData } from "./publish-conversation-message.js";

export type HumanHandoffScope = {
  conversationId: string;
  customerId: string | null;
  guestIdentityId?: string;
  customerMessageId: string;
  aiVersion: number;
  jobLease?: ImageMessageJobLease;
};

export const humanHandoffAcknowledgement =
  "I've passed this conversation to the AMAC team for review. You can continue messaging here while waiting for their reply.";

// All mutation, acknowledgement and successful execution linkage commit together.
export function requestHumanHandoffData({
  db,
  scope,
  handoff,
  callId,
  turnId,
  abortSignal,
}: {
  db: Kysely<DB>;
  scope: HumanHandoffScope;
  handoff: AiHandoff;
  callId: string;
  turnId: string;
  abortSignal?: AbortSignal;
}) {
  return db.transaction().execute(async (trx) => {
    const conversation = await trx
      .selectFrom("conversations")
      .selectAll()
      .where("id", "=", scope.conversationId)
      .forUpdate()
      .executeTakeFirst();
    const owned =
      conversation &&
      (scope.guestIdentityId
        ? conversation.guest_identity_id === scope.guestIdentityId ||
          conversation.claimed_guest_identity_id === scope.guestIdentityId
        : scope.customerId !== null &&
          conversation.customer_id === scope.customerId);

    if (!owned) throw new Error("Assistant turn is no longer active");

    if (conversation.guest_identity_id)
      assertGuestActive(await withConversationActivity(trx, conversation));

    if (scope.jobLease)
      await assertImageMessageJobLeaseData(trx, scope.jobLease, abortSignal);

    const execution = await trx
      .selectFrom("ai_tool_calls")
      .select("id")
      .where("id", "=", callId)
      .where("turn_id", "=", turnId)
      .where("customer_message_id", "=", scope.customerMessageId)
      .where("tool_name", "=", "requestHumanHandoff")
      .where("status", "=", "started")
      .where("assistant_message_id", "is", null)
      .forUpdate()
      .executeTakeFirst();

    if (!execution) throw new Error("Handoff execution is unavailable");

    const trigger = await trx
      .selectFrom("messages")
      .select(["id", "sender_id"])
      .where("id", "=", scope.customerMessageId)
      .where("conversation_id", "=", scope.conversationId)
      .where("sender_role", "=", "customer")
      .executeTakeFirst();

    if (
      !trigger ||
      (scope.guestIdentityId
        ? trigger.sender_id !== null
        : trigger.sender_id !== scope.customerId)
    )
      throw new Error("Customer message not found");

    // A retried invocation of the same customer action reuses its committed reply.
    // The row lock serializes concurrent calls, including different turn IDs.
    const previous = await trx
      .selectFrom("messages")
      .selectAll()
      .where("reply_to_message_id", "=", scope.customerMessageId)
      .executeTakeFirst();

    if (previous) {
      const committedHandoff = await trx
        .selectFrom("ai_tool_calls")
        .select("id")
        .where("customer_message_id", "=", scope.customerMessageId)
        .where("tool_name", "=", "requestHumanHandoff")
        .where("status", "=", "succeeded")
        .where("assistant_message_id", "=", previous.id)
        .executeTakeFirst();

      if (!committedHandoff)
        throw new Error("This message already has a reply");
    }

    if (
      !previous &&
      (!conversation.ai_enabled || conversation.ai_version !== scope.aiVersion)
    )
      throw new Error("Assistant turn is no longer active");

    abortSignal?.throwIfAborted();
    const message =
      previous ??
      (await trx
        .insertInto("messages")
        .values({
          conversation_id: scope.conversationId,
          sender_id: null,
          sender_role: "assistant",
          body: humanHandoffAcknowledgement,
          reply_to_message_id: scope.customerMessageId,
          created_at: sql<Date>`clock_timestamp()`,
        })
        .returningAll()
        .executeTakeFirstOrThrow());

    if (!previous)
      await trx
        .updateTable("conversations")
        .set({
          ai_handoff: handoff,
          ai_enabled: false,
          ai_version: conversation.ai_version + 1,
          updated_at: message.created_at,
        })
        .where("id", "=", scope.conversationId)
        .execute();

    await trx
      .updateTable("guest_message_requests")
      .set({
        assistant_message_id: message.id,
        assistant_error: null,
        completed: true,
      })
      .where("message_id", "=", scope.customerMessageId)
      .execute();
    await finishToolCallData(trx, {
      id: callId,
      status: "succeeded",
      output: { status: "handed_off" },
    });
    await linkToolCallsToReplyData(trx, {
      turnId,
      customerMessageId: scope.customerMessageId,
      assistantMessageId: message.id,
    });

    if (!previous && conversation.customer_id)
      await publishConversationMessageData(trx, conversation.id, message.id);

    return { ...message, sender_display_name: null, sender_email: null };
  });
}
