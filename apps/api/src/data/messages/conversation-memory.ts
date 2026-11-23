import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { finishToolCallData } from "../ai/finish-tool-call.js";
import { guestIsActive } from "../guest-chat/activity.js";
import {
  assertImageMessageJobLeaseData,
  type ImageMessageJobLease,
} from "./message-processing.js";

export type ConversationMemoryScope = {
  conversationId: string;
  customerId: string | null;
  guestIdentityId?: string;
  customerMessageId: string;
  aiVersion: number;
  jobLease?: ImageMessageJobLease;
};

export function readConversationMemoryData(
  db: Kysely<DB>,
  scope: ConversationMemoryScope,
) {
  const latest = db
    .selectFrom("messages")
    .select(["id", "conversation_id", "sender_id"])
    .where("conversation_id", "=", scope.conversationId)
    .where("sender_role", "=", "customer")
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(1)
    .as("latest");

  // Read the note and its latest customer message in one statement snapshot.
  return db
    .selectFrom("conversations as c")
    .innerJoin(latest, "latest.conversation_id", "c.id")
    .select("c.conversation_memory")
    .where("c.id", "=", scope.conversationId)
    .where("c.ai_enabled", "=", true)
    .where("c.ai_version", "=", scope.aiVersion)
    .where(guestIsActive())
    .where("latest.id", "=", scope.customerMessageId)
    .where((eb) =>
      scope.guestIdentityId
        ? eb.and([
            eb("latest.sender_id", "is", null),
            eb.or([
              eb("c.guest_identity_id", "=", scope.guestIdentityId),
              eb("c.claimed_guest_identity_id", "=", scope.guestIdentityId),
            ]),
          ])
        : eb.and([
            eb("c.customer_id", "=", scope.customerId),
            eb("latest.sender_id", "=", scope.customerId),
          ]),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("messages as reply")
            .select("reply.id")
            .whereRef("reply.reply_to_message_id", "=", "latest.id"),
        ),
      ),
    )
    .executeTakeFirst();
}

export function updateConversationMemoryData({
  db,
  scope,
  expectedMemory,
  markdown,
  callId,
  abortSignal,
}: {
  db: Kysely<DB>;
  scope: ConversationMemoryScope;
  expectedMemory: string | null;
  markdown: string;
  callId: string;
  abortSignal?: AbortSignal;
}) {
  return db.transaction().execute(async (trx) => {
    abortSignal?.throwIfAborted();
    const locked = await trx
      .selectFrom("conversations")
      .select("id")
      .where("id", "=", scope.conversationId)
      .forUpdate()
      .executeTakeFirst();

    // A writer may have saved a newer message while this lock was waiting.
    // Recheck the trigger and current note in a fresh statement after the lock.
    const current = locked && (await readConversationMemoryData(trx, scope));
    let status: "updated" | "unchanged" | "skipped" = "skipped";

    if (current && current.conversation_memory === expectedMemory) {
      if (scope.jobLease)
        await assertImageMessageJobLeaseData(trx, scope.jobLease, abortSignal);

      abortSignal?.throwIfAborted();
      status = "unchanged";

      if (current.conversation_memory !== markdown) {
        await trx
          .updateTable("conversations")
          .set({ conversation_memory: markdown })
          .where("id", "=", scope.conversationId)
          .execute();
        status = "updated";
      }
    }

    const output = { status };
    abortSignal?.throwIfAborted();
    await finishToolCallData(trx, { id: callId, status: "succeeded", output });
    abortSignal?.throwIfAborted();

    return output;
  });
}
