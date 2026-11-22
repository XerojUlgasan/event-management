import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import {
  completeGuestImageMessageRequestData,
  hasCommittedImageMessageJobData,
} from "../messages/image-message-job-outcome.js";
import type { JobRetryPolicies, QueueJob } from "./types.js";

export async function retryJobData(
  trx: Transaction<DB>,
  job: QueueJob,
  policies: JobRetryPolicies,
  reason: string,
  permanent = false,
  requireFresh = false,
  errorCode?: string,
) {
  const delays = policies[job.type];

  if (!delays) return;

  // Domain commits take this same row lock. Lock before observing their state:
  // after waiting, the next statement must see a reply committed during expiry.
  const owned = await sql<{ id: string }>`select id from background_jobs
    where id = ${job.id}::uuid and status = 'running' and lease_token = ${job.lease_token}::uuid
      and (${!requireFresh} or lease_expires_at > clock_timestamp()) for update`.execute(
    trx,
  );

  if (!owned.rows.length) return false;

  const isImageMessageJob = job.type === "process_image_message";

  // A process may die after the domain commit and before queue completion.
  // Reconcile delivered replies even on the final attempt; never report a saved
  // answer as failed or execute its model again merely to finish the queue row.
  if (
    isImageMessageJob &&
    !permanent &&
    (await hasCommittedImageMessageJobData(trx, job))
  ) {
    const result = await sql<{
      id: string;
    }>`update background_jobs set status = 'completed',
        lease_token = null, lease_expires_at = null, last_error = null,
        completed_at = clock_timestamp(), updated_at = clock_timestamp()
        where id = ${job.id}::uuid and status = 'running' and lease_token = ${job.lease_token}::uuid
          and (${!requireFresh} or lease_expires_at > clock_timestamp()) returning id`.execute(
      trx,
    );

    if (result.rows.length)
      await completeGuestImageMessageRequestData(trx, job.dedupe_key);

    return result.rows.length > 0;
  }

  const successor =
    job.dedupe_key !== null &&
    (
      await sql<{ exists: boolean }>`select exists(
    select 1 from background_jobs where status = 'pending' and type = ${job.type} and dedupe_key = ${job.dedupe_key}
  ) as exists`.execute(trx)
    ).rows[0]?.exists;
  const delay = delays[job.attempts - 1];
  const fail = permanent || successor || delay === undefined;
  const lastError = isImageMessageJob
    ? (errorCode ?? (permanent ? "invalid_payload" : "processing_unavailable"))
    : successor
      ? "Superseded by a newer job"
      : reason;
  const result = await sql<{
    id: string;
  }>`update background_jobs set status = ${fail ? "failed" : "pending"},
    available_at = case when ${fail} then available_at else clock_timestamp() + ${delay ?? 0} * interval '1 millisecond' end,
    lease_token = null, lease_expires_at = null, last_error = ${lastError},
    completed_at = case when ${fail} then clock_timestamp() else null end, updated_at = clock_timestamp()
    where id = ${job.id}::uuid and status = 'running' and lease_token = ${job.lease_token}::uuid
      and (${!requireFresh} or lease_expires_at > clock_timestamp()) returning id`.execute(
    trx,
  );

  if (result.rows.length && isImageMessageJob && fail)
    await completeGuestImageMessageRequestData(
      trx,
      job.dedupe_key,
      "Your message was saved, but processing is unavailable. Retry from the saved message.",
    );

  return result.rows.length > 0;
}
