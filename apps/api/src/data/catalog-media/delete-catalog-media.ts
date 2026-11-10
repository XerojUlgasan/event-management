import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const deleteCatalogMediaData = (db: Database, id: string) =>
  db.deleteFrom("media_assets").where("id", "=", id).execute();
