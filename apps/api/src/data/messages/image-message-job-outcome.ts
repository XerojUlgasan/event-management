import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { imageMessageJobPayloadSchema } from "../../types/image-message-job.js";
import { guestIsActive } from "../guest-chat/activity.js";

export async function hasCommittedImageMessageJobData(
  trx: Transaction<DB>,
  job: { id: string; payload: unknown; dedupe_key: string | null },
) {
  if (!imageMessageJobPayloadSchema.safeParse(job.payload).success)
    return false;

  const committed = await sql<{ done: boolean }>`select (
      exists(select 1 from messages reply where reply.reply_to_message_id::text = ${job.dedupe_key})
      or ((payload->>'aiVersion' is null or payload->>'suppressReply' = 'true'
        or exists(select 1 from conversations c where c.id::text = payload->>'conversationId'
          and (not c.ai_enabled or c.ai_version::text is distinct from payload->>'aiVersion' or not ${guestIsActive()})))
        and not exists(select 1 from message_images i where i.message_id::text = ${job.dedupe_key} and i.interpretation is null))
      ) and payload ? 'aiVersion' and exists(select 1 from messages trigger
        where trigger.id::text = ${job.dedupe_key} and trigger.id::text = payload->>'messageId'
          and trigger.conversation_id::text = payload->>'conversationId' and trigger.sender_role in ('customer', 'admin'))
      as done from background_jobs where id = ${job.id}::uuid`.execute(trx);

  return committed.rows[0]?.done === true;
}

export async function completeGuestImageMessageRequestData(
  trx: Transaction<DB>,
  messageId: string | null,
  assistantError: string | null = null,
) {
  await sql`update guest_message_requests set completed = true, assistant_error = ${assistantError}
    where message_id::text = ${messageId}`.execute(trx);
}
