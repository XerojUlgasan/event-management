import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { completeGuestImageMessageRequestData } from "../messages/image-message-job-outcome.js";
import { boundBackgroundJobTransactionData } from "./lock-background-jobs.js";
import { retryJobData } from "./retry-job.js";
import type { JobRetryPolicies, QueueJob } from "./types.js";

export async function finishJobData(
  db: Kysely<DB>,
  job: QueueJob,
  outcome: "success" | "retry" | "invalid" | "permanent",
  policies: JobRetryPolicies,
  errorCode?: string,
) {
  return db.transaction().execute(async (trx) => {
    await boundBackgroundJobTransactionData(trx);
    const fresh =
      await sql<QueueJob>`select id, type, payload, dedupe_key, attempts, lease_token from background_jobs
      where id = ${job.id}::uuid and status = 'running' and lease_token = ${job.lease_token}::uuid
      and lease_expires_at > clock_timestamp()`.execute(trx);
    const current = fresh.rows[0];

    if (!current) return false;

    if (outcome === "success") {
      const result = await sql<{
        id: string;
      }>`update background_jobs set status = 'completed', lease_token = null, lease_expires_at = null,
        completed_at = clock_timestamp(), updated_at = clock_timestamp(), last_error = null where id = ${job.id}::uuid
        and status = 'running' and lease_token = ${job.lease_token}::uuid and lease_expires_at > clock_timestamp() returning id`.execute(
        trx,
      );

      if (result.rows.length && job.type === "process_image_message")
        await completeGuestImageMessageRequestData(trx, job.dedupe_key);

      return result.rows.length > 0;
    }

    return (
      (await retryJobData(
        trx,
        current,
        policies,
        outcome === "invalid" ? "Invalid job payload" : "Job execution failed",
        outcome === "invalid" || outcome === "permanent",
        true,
        errorCode,
      )) ?? false
    );
  });
}
