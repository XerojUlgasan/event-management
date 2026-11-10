import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const listStatusHistoryData = (db: Database, ids: string[]) =>
  ids.length
    ? db
        .selectFrom("booking_request_status_history")
        .selectAll()
        .where("booking_request_id", "in", ids)
        .orderBy("created_at", "asc")
        .orderBy("id", "asc")
        .execute()
    : Promise.resolve([]);
