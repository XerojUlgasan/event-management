import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { utcTimestampSql } from "../../utils/sql-page.js";
export type Database = Kysely<DB> | Transaction<DB>;
export const quoteRevision = utcTimestampSql("updated_at");
export const nextQuoteRevision = sql<Date>`greatest(clock_timestamp(), updated_at + interval '1 microsecond')`;
