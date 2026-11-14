import { sql } from "kysely";
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
      sql<boolean>`EXISTS (
  SELECT 1 FROM catalog_widgets w JOIN catalog_sections s ON s.id=w.section_id JOIN catalog_pages cp ON cp.id=s.page_id
  LEFT JOIN packages p ON p.id=cp.package_id LEFT JOIN services sv ON sv.id=cp.service_id
  WHERE w.media_id=m.id AND ((p.id IS NOT NULL AND p.package_type='catalog' AND p.archived_at IS NULL)
    OR (sv.id IS NOT NULL AND sv.archived_at IS NULL))
)`,
    )
    .executeTakeFirst();
