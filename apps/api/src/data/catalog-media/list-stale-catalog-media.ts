import { sql } from "kysely";
import { anyCatalogOwnerContainsMedia } from "./canvas-reference.js";
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
    .where(sql<boolean>`NOT ${anyCatalogOwnerContainsMedia(sql.ref("m.id"))}`)
    .orderBy("m.created_at")
    .orderBy("m.id")
    .limit(limit)
    .execute();
