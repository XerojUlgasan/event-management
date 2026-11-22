import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { boundBackgroundJobTransactionData } from "./lock-background-jobs.js";
import type { QueueJob } from "./types.js";

export async function heartbeatJobData(
  db: Kysely<DB>,
  job: QueueJob,
  leaseMs: number,
) {
  return db.transaction().execute(async (trx) => {
    await boundBackgroundJobTransactionData(trx);
    const result = await sql<{
      id: string;
    }>`update background_jobs set lease_expires_at = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
      updated_at = clock_timestamp() where id = ${job.id}::uuid and status = 'running'
      and lease_token = ${job.lease_token}::uuid and lease_expires_at > clock_timestamp() returning id`.execute(
      trx,
    );

    return result.rows.length > 0;
  });
}
