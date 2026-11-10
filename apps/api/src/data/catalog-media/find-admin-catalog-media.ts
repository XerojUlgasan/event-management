import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const findAdminCatalogMediaData = (
  db: Database,
  id: string,
  actorId: string,
) =>
  db
    .selectFrom("media_assets as m")
    .selectAll("m")
    .where("m.id", "=", id)
    .where("m.source", "=", "upload")
    .where((eb) =>
      eb.or([
        eb("m.created_by", "=", actorId),
        sql<boolean>`EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id)`,
      ]),
    )
    .executeTakeFirst();
