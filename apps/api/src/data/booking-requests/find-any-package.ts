import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export const findAnyPackageData = (db: Database, id: string) =>
  db.selectFrom("packages").selectAll().where("id", "=", id).executeTakeFirst();
