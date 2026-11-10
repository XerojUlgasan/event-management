import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const listStaleCatalogMediaData = (
  db: Database,
  before: Date,
  limit: number,
) =>
  db
    .selectFrom("media_assets as m")
    .select("m.id")
    .where("m.created_at", "<", before)
    .where(
      sql<boolean>`NOT EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id)`,
    )
    .orderBy("m.created_at")
    .orderBy("m.id")
    .limit(limit)
    .execute();
