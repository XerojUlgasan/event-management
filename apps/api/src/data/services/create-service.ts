import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
export const createServiceData = (db: Transaction<DB>) => db.insertInto("services").defaultValues().returningAll().executeTakeFirstOrThrow();
