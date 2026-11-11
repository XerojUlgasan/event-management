import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
export type Database = Kysely<DB> | Transaction<DB>;
export const quoteRevision = sql<string>`to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
export const nextQuoteRevision = sql<Date>`greatest(clock_timestamp(), updated_at + interval '1 microsecond')`;
