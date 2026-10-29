import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function createVenueData(db: Transaction<DB>) { return db.insertInto("venues").defaultValues().returningAll().executeTakeFirstOrThrow(); }
