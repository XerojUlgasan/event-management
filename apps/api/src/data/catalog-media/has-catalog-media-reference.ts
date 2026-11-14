import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const hasCatalogMediaReferenceData = (db: Database, id: string) =>
  db
    .selectFrom("media_assets as m")
    .select("m.id")
    .where("m.id", "=", id)
    .where(
      sql<boolean>`EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id)`,
    )
    .executeTakeFirst();
