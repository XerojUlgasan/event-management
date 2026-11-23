import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockBackgroundJobsData } from "./lock-background-jobs.js";

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
  await lockBackgroundJobsData(trx);
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
