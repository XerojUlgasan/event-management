import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function archiveVenueData(db: Transaction<DB>, id: string, now: Date) { return db.updateTable("venues").set({ archived_at: now, updated_at: now }).where("id", "=", id).returningAll().executeTakeFirstOrThrow(); }
