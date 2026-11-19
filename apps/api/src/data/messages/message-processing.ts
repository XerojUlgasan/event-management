import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type {
  MessageProcessing,
  MessageImageInterpretation,
} from "@event-management/contracts/message-images";
import { enqueueBackgroundJobService } from "../../services/background-jobs/enqueue-job.js";

export type ImageMessageJobLease = { jobId: string; leaseToken: string };

export type ImageMessageJobPayload = {
  messageId: string;
  conversationId: string;
  aiVersion: number | null;
  suppressReply?: true;
};

export const messageProcessingErrorCodes = [
  "invalid_image",
  "invalid_payload",
  "image_unavailable",
  "vision_unavailable",
  "reply_unavailable",
  "processing_unavailable",
] as const;

// The handler may interpret images without producing a reply. Keep the visible
// reply state aligned with its scope, version, and later-reply guards.
const replyPendingCondition = (messageAlias: string) => {
  const m = (column: string) => sql.ref(`${messageAlias}.${column}`);

  return sql`j.status in ('pending', 'running')
  and ${m("sender_role")} = 'customer'
  and c.status = 'active' and c.ai_enabled
  and (c.guest_identity_id is null or c.guest_expires_at > clock_timestamp())
  and j.payload->>'messageId' = ${m("id")}::text
  and j.payload->>'conversationId' = c.id::text
  and j.payload->>'aiVersion' = c.ai_version::text
  and j.payload->>'suppressReply' is distinct from 'true'
  and ((${m("guest_origin")} and ${m("sender_id")} is null and coalesce(c.guest_identity_id, c.claimed_guest_identity_id) is not null)
    or (not ${m("guest_origin")} and ${m("sender_id")} is not null and ${m("sender_id")} = c.customer_id))
  and not exists (select 1 from messages reply where reply.reply_to_message_id = ${m("id")})
  and not exists (select 1 from messages reply join messages trigger on trigger.id = reply.reply_to_message_id
    where reply.conversation_id = c.id and (trigger.created_at, trigger.id) > (${m("created_at")}, ${m("id")}))`;
};

export const conversationAiReplyPendingSelection = () =>
  sql<boolean>`exists (select 1 from messages m join background_jobs j
    on j.type = 'process_image_message' and j.dedupe_key = m.id::text
    where m.conversation_id = c.id and ${replyPendingCondition("m")})`.as(
    "ai_reply_pending",
  );

// Domain commits and recovery share this row lock; provider work stays outside.
export async function assertImageMessageJobLeaseData(
  trx: Transaction<DB>,
  lease: ImageMessageJobLease,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const current = await sql<{ id: string }>`select id from background_jobs
    where id = ${lease.jobId}::uuid and status = 'running'
      and lease_token = ${lease.leaseToken}::uuid and lease_expires_at > clock_timestamp() for update`.execute(
    trx,
  );

  if (!current.rows.length) throw new Error("Message job lease lost");

  signal?.throwIfAborted();
}

export const messageProcessingSelection = (alias = "m") =>
  sql<MessageProcessing | null>`(
  select json_build_object('status', case
    when j.status = 'pending' then 'queued'
    when j.status = 'running' then case when exists(select 1 from message_images i where i.message_id = ${sql.ref(`${alias}.id`)} and i.interpretation is null) then 'interpreting' else 'replying' end
    when j.status = 'completed' then case when j.payload->>'aiVersion' is null or exists(select 1 from messages reply where reply.reply_to_message_id = ${sql.ref(`${alias}.id`)}) then 'completed' else 'suppressed' end
    else 'failed' end,
    'errorCode', case when j.last_error in (${sql.join(messageProcessingErrorCodes)}) then j.last_error else null end,
    'replyPending', coalesce((select ${replyPendingCondition("source")} from conversations c join messages source on source.conversation_id = c.id where source.id = ${sql.ref(`${alias}.id`)}), false),
    'canRetry', j.status = 'failed' and j.last_error is distinct from 'invalid_image' and j.last_error is distinct from 'invalid_payload'
      and not exists(select 1 from messages reply where reply.reply_to_message_id = ${sql.ref(`${alias}.id`)}))
  from background_jobs j where j.type = 'process_image_message' and j.dedupe_key = ${sql.ref(`${alias}.id`)}::text
  order by j.created_at desc, j.id desc limit 1)`.as("processing");

export async function enqueueImageMessageProcessingData(
  trx: Transaction<DB>,
  messageId: string,
  conversation: { id: string; ai_version: number; ai_enabled: boolean },
  senderRole: "customer" | "admin",
  hasImages: boolean,
) {
  const aiVersion =
    senderRole === "customer" && conversation.ai_enabled
      ? conversation.ai_version
      : null;

  if (!hasImages) return null;

  const jobId = await enqueueBackgroundJobService(
    trx,
    "process_image_message",
    {
      messageId,
      conversationId: conversation.id,
      aiVersion,
    },
  );

  if (!jobId) throw new Error("Message job enqueue failed");

  return {
    status: "queued" as const,
    errorCode: null,
    canRetry: false,
    replyPending: aiVersion !== null,
  };
}

export async function loadImageMessageJobData(
  db: Kysely<DB>,
  payload: ImageMessageJobPayload,
) {
  const message = await db
    .selectFrom("messages")
    .selectAll()
    .where("id", "=", payload.messageId)
    .where("conversation_id", "=", payload.conversationId)
    .executeTakeFirstOrThrow();
  const conversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", payload.conversationId)
    .executeTakeFirstOrThrow();
  const images = await db
    .selectFrom("message_images")
    .selectAll()
    .where("message_id", "=", message.id)
    .orderBy("position")
    .execute();

  return { message, conversation, images };
}

export async function saveMessageImageObservationData(
  db: Kysely<DB>,
  imageId: string,
  observation: MessageImageInterpretation,
  lease: ImageMessageJobLease,
  signal: AbortSignal,
) {
  await db.transaction().execute(async (trx) => {
    await assertImageMessageJobLeaseData(trx, lease, signal);
    await trx
      .updateTable("message_images")
      .set({ interpretation: JSON.stringify(observation) })
      .where("id", "=", imageId)
      .execute();
  });
}

export async function hasLaterMessageReplyData(
  db: Kysely<DB>,
  payload: ImageMessageJobPayload,
) {
  const result = await sql<{ exists: boolean }>`select exists(
    select 1 from messages reply join messages trigger on trigger.id = reply.reply_to_message_id
    join messages current on current.id = ${payload.messageId}::uuid
    where reply.conversation_id = ${payload.conversationId}::uuid
      and (trigger.created_at, trigger.id) > (current.created_at, current.id)) as exists`.execute(
    db,
  );

  return result.rows[0]?.exists ?? false;
}
