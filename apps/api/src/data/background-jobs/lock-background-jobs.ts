import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const lockBackgroundJobsData = async (trx: Transaction<DB>) => {
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

export const boundBackgroundJobTransactionData = async (
  trx: Transaction<DB>,
) => {
  await sql`set local statement_timeout = '10s'`.execute(trx);
  await lockBackgroundJobsData(trx);
};
