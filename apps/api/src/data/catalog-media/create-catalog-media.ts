import type { Insertable, Kysely, Transaction } from "kysely";
import type { DB, MediaAssets } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export const createCatalogMediaData = (
  db: Database,
  values: Insertable<MediaAssets>,
) =>
  db
    .insertInto("media_assets")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
