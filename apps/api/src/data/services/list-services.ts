import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const listServicesData = (db: Database) => db.selectFrom("services").selectAll().orderBy("created_at", "desc").execute();
