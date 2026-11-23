import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockBackgroundJobsData } from "./lock-background-jobs.js";

// Manual scheduling must not refresh retries or create a successor for work
// already running. Expired leases remain active until the worker recovers them.
export async function ensureJobScheduledData(
  trx: Transaction<DB>,
  type: string,
  payload: unknown,
  key: string,
): Promise<"inserted" | "already-active"> {
  await lockBackgroundJobsData(trx);
  const active = await sql<{ exists: boolean }>`select exists (
    select 1 from background_jobs where type = ${type} and dedupe_key = ${key}
      and status in ('pending', 'running')
  ) as exists`.execute(trx);

  if (active.rows[0]?.exists) return "already-active";

  await sql`insert into background_jobs (type, payload, dedupe_key)
    values (${type}, ${JSON.stringify(payload)}::jsonb, ${key})`.execute(trx);

  return "inserted";
}
