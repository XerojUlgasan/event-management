import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const hasCatalogMediaReferenceData = (db: Database, id: string) =>
  db
    .selectFrom("catalog_widgets")
    .select("id")
    .where("media_id", "=", id)
    .executeTakeFirst();
