import { sql } from "kysely";
import { anyCanvasContainsMedia } from "./canvas-reference.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const hasCatalogMediaReferenceData = (db: Database, id: string) =>
  db
    .selectFrom("media_assets as m")
    .select("m.id")
    .where("m.id", "=", id)
    .where((eb) =>
      eb.or([
        anyCanvasContainsMedia(sql.ref("m.id")),
        eb.exists(
          eb
            .selectFrom("packages")
            .select("id")
            .where("thumbnail_media_id", "=", id),
        ),
        eb.exists(
          eb
            .selectFrom("services")
            .select("id")
            .where("thumbnail_media_id", "=", id),
        ),
      ]),
    )
    .executeTakeFirst();
