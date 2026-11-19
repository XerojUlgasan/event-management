import { randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export type JobRetryPolicies = Readonly<Record<string, readonly number[]>>;
type QueueJob = {
  id: string;
  type: string;
  payload: unknown;
  dedupe_key: string | null;
  attempts: number;
  lease_token: string;
};
const lock = async (trx: Transaction<DB>) => {
  // Restore the caller's setting: enqueue participates in a larger transaction.
  const previous = await sql<{
    value: string;
  }>`select current_setting('lock_timeout') as value`.execute(trx);
  await sql`set local lock_timeout = '5s'`.execute(trx);
  await sql`select pg_advisory_xact_lock(1129073994, 1)`.execute(trx);
  await sql`select set_config('lock_timeout', ${previous.rows[0]?.value ?? "0"}, true)`.execute(
    trx,
  );
};
const boundTransaction = async (trx: Transaction<DB>) => {
  await sql`set local statement_timeout = '10s'`.execute(trx);
  await lock(trx);
};

export async function enqueueJobData(
  trx: Transaction<DB>,
  type: string,
  payload: unknown,
  key: string,
) {
  const previous = await sql<{
    value: string;
  }>`select current_setting('statement_timeout') as value`.execute(trx);
  await sql`set local statement_timeout = '10s'`.execute(trx);
  await lock(trx);
  const result = await sql<{ id: string }>`
    insert into background_jobs (type, payload, dedupe_key)
    values (${type}, ${JSON.stringify(payload)}::jsonb, ${key})
    on conflict (type, dedupe_key) where status = 'pending' and dedupe_key is not null
    do update set payload = excluded.payload, attempts = 0, available_at = clock_timestamp(),
      last_error = null, updated_at = clock_timestamp()
    returning id`.execute(trx);
  await sql`select set_config('statement_timeout', ${previous.rows[0]?.value ?? "0"}, true)`.execute(
    trx,
  );
  return result.rows[0]?.id;
}

// All state transitions are serialized briefly; external work never holds this lock.
export async function claimJobData(
  db: Kysely<DB>,
  leaseMs: number,
  policies: JobRetryPolicies,
): Promise<QueueJob | undefined> {
  return db.transaction().execute(async (trx) => {
    await boundTransaction(trx);
    const types = Object.keys(policies);
    if (!types.length) return undefined;
    const expired =
      await sql<QueueJob>`select id, type, payload, dedupe_key, attempts, lease_token
      from background_jobs where status = 'running' and lease_expires_at <= clock_timestamp()
      and type in (${sql.join(types)}) order by lease_expires_at limit 32`.execute(
        trx,
      );
    for (const job of expired.rows) {
      await retryOrFail(trx, job, policies, "Job lease expired");
    }
    // A deployment may shorten retry policy for jobs already pending.
    // Bound cleanup per poll and never claim rows that have exhausted that policy.
    for (const [type, delays] of Object.entries(policies)) {
      await sql`update background_jobs set status = 'failed', last_error = 'Job attempts exhausted',
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
        and not exists (select 1 from background_jobs r where r.status = 'running'
          and r.type = p.type and r.dedupe_key = p.dedupe_key and p.dedupe_key is not null)
        order by p.available_at, p.created_at, p.id limit 1)
      returning id, type, payload, dedupe_key, attempts, lease_token`.execute(
        trx,
      );
    return result.rows[0];
  });
}

async function retryOrFail(
  trx: Transaction<DB>,
  job: QueueJob,
  policies: JobRetryPolicies,
  reason: string,
  permanent = false,
  requireFresh = false,
) {
  const delays = policies[job.type];
  if (!delays) return;
  const successor =
    job.dedupe_key !== null &&
    (
      await sql<{ exists: boolean }>`select exists(
    select 1 from background_jobs where status = 'pending' and type = ${job.type} and dedupe_key = ${job.dedupe_key}
  ) as exists`.execute(trx)
    ).rows[0]?.exists;
  const delay = delays[job.attempts - 1];
  const fail = permanent || successor || delay === undefined;
  const result = await sql<{
    id: string;
  }>`update background_jobs set status = ${fail ? "failed" : "pending"},
    available_at = case when ${fail} then available_at else clock_timestamp() + ${delay ?? 0} * interval '1 millisecond' end,
    lease_token = null, lease_expires_at = null, last_error = ${successor ? "Superseded by a newer job" : reason},
    completed_at = case when ${fail} then clock_timestamp() else null end, updated_at = clock_timestamp()
    where id = ${job.id}::uuid and status = 'running' and lease_token = ${job.lease_token}::uuid
      and (${!requireFresh} or lease_expires_at > clock_timestamp()) returning id`.execute(
    trx,
  );
  return result.rows.length > 0;
}

export async function finishJobData(
  db: Kysely<DB>,
  job: QueueJob,
  outcome: "success" | "retry" | "invalid",
  policies: JobRetryPolicies,
) {
  return db.transaction().execute(async (trx) => {
    await boundTransaction(trx);
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
      return result.rows.length > 0;
    }
    return (
      (await retryOrFail(
        trx,
        current,
        policies,
        outcome === "invalid" ? "Invalid job payload" : "Job execution failed",
        outcome === "invalid",
        true,
      )) ?? false
    );
  });
}

export async function heartbeatJobData(
  db: Kysely<DB>,
  job: QueueJob,
  leaseMs: number,
) {
  return db.transaction().execute(async (trx) => {
    await boundTransaction(trx);
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
