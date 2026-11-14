import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const findServiceData = (db: Database, id: string) =>
  db.selectFrom("services").selectAll().where("id", "=", id).executeTakeFirst();
