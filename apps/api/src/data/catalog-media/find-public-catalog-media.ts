import { sql } from "kysely";
import { catalogOwnerContainsMedia } from "./canvas-reference.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const findPublicCatalogMediaData = (db: Database, id: string) =>
  db
    .selectFrom("media_assets as m")
    .selectAll("m")
    .where("m.id", "=", id)
    .where("m.source", "=", "upload")
    .where(
      sql<boolean>`(
  EXISTS (SELECT 1 FROM packages p WHERE p.package_type='catalog' AND p.archived_at IS NULL
    AND ${catalogOwnerContainsMedia("p", sql.ref("m.id"))})
  OR EXISTS (SELECT 1 FROM services sv WHERE sv.archived_at IS NULL
    AND ${catalogOwnerContainsMedia("sv", sql.ref("m.id"))})
)`,
    )
    .executeTakeFirst();
