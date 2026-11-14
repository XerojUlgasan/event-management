import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const findCatalogMediaData = (db: Database, id: string) =>
  db
    .selectFrom("media_assets")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
