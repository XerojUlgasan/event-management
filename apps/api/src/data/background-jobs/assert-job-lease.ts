import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export type BackgroundJobLease = { jobId: string; leaseToken: string };

// Lock the lease row through the domain write so recovery cannot overtake it.
export async function assertBackgroundJobLeaseData(
  trx: Transaction<DB>,
  lease: BackgroundJobLease,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const current = await sql<{ id: string }>`select id from background_jobs
    where id = ${lease.jobId}::uuid and status = 'running'
      and lease_token = ${lease.leaseToken}::uuid and lease_expires_at > clock_timestamp() for update`.execute(
    trx,
  );

  if (!current.rows.length) throw new Error("Background job lease lost");

  signal?.throwIfAborted();
}
