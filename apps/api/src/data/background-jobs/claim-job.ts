import { randomUUID } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { boundBackgroundJobTransactionData } from "./lock-background-jobs.js";
import { retryJobData } from "./retry-job.js";
import type { JobRetryPolicies, QueueJob } from "./types.js";

// All state transitions are serialized briefly; external work never holds this lock.
export async function claimJobData(
  db: Kysely<DB>,
  leaseMs: number,
  policies: JobRetryPolicies,
): Promise<QueueJob | undefined> {
  return db.transaction().execute(async (trx) => {
    await boundBackgroundJobTransactionData(trx);
    const types = Object.keys(policies);

    if (!types.length) return undefined;

    const expired =
      await sql<QueueJob>`select id, type, payload, dedupe_key, attempts, lease_token
      from background_jobs where status = 'running' and lease_expires_at <= clock_timestamp()
      and type in (${sql.join(types)}) order by lease_expires_at limit 32`.execute(
        trx,
      );

    for (const job of expired.rows) {
      await retryJobData(trx, job, policies, "Job lease expired");
    }

    // A deployment may shorten retry policy for jobs already pending.
    // Bound cleanup per poll and never claim rows that have exhausted that policy.
    for (const [type, delays] of Object.entries(policies)) {
      await sql`update background_jobs set status = 'failed', last_error = case when type = 'process_image_message' then 'processing_unavailable' else 'Job attempts exhausted' end,
        completed_at = clock_timestamp(), updated_at = clock_timestamp()
        where id in (select id from background_jobs where status = 'pending' and type = ${type}
          and available_at <= clock_timestamp() and attempts >= ${delays.length + 1}
          order by available_at, created_at, id limit 32)`.execute(trx);
    }

    const eligiblePolicies = Object.entries(policies).map(
      ([type, delays]) =>
        sql`(p.type = ${type} and p.attempts < ${delays.length + 1})`,
    );

    const token = randomUUID();
    const result =
      await sql<QueueJob>`update background_jobs set status = 'running', attempts = attempts + 1,
      lease_token = ${token}::uuid, lease_expires_at = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
      updated_at = clock_timestamp()
      where id = (select p.id from background_jobs p where p.status = 'pending'
        and p.available_at <= clock_timestamp() and (${sql.join(eligiblePolicies, sql` or `)})
        and (p.type <> 'process_image_message' or not exists (
          select 1 from messages current
          join messages other on other.conversation_id = current.conversation_id
          join background_jobs running on running.dedupe_key = other.id::text
          where current.id::text = p.dedupe_key and running.type = 'process_image_message' and running.status = 'running'))
        and (p.type <> 'process_image_message' or not exists (
          select 1 from messages current
          join messages earlier on earlier.conversation_id = current.conversation_id
          join background_jobs predecessor on predecessor.dedupe_key = earlier.id::text
          where current.id::text = p.dedupe_key and predecessor.type = 'process_image_message'
            and predecessor.status in ('pending', 'running')
            and (earlier.created_at, earlier.id) < (current.created_at, current.id)))
        and not exists (select 1 from background_jobs r where r.status = 'running'
          and r.type = p.type and r.dedupe_key = p.dedupe_key and p.dedupe_key is not null)
        order by p.available_at, p.created_at, p.id limit 1)
      returning id, type, payload, dedupe_key, attempts, lease_token`.execute(
        trx,
      );

    return result.rows[0];
  });
}
