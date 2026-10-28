import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const listVersionsData = (db: Database, id: string) => db.selectFrom("service_versions").selectAll().where("service_id", "=", id).orderBy("version", "desc").execute();
