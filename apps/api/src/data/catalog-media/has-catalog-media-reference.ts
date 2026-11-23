import { sql, type ExpressionBuilder } from "kysely";
import { anyCatalogOwnerContainsMedia } from "./canvas-reference.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export const catalogMediaHasReference = (
  eb: ExpressionBuilder<DB & { m: DB["media_assets"] }, "m">,
) =>
  eb.or([
    anyCatalogOwnerContainsMedia(sql.ref("m.id")),
    eb("m.showcase_record_id", "is not", null),
    eb.exists(
      eb
        .selectFrom("showcase_records")
        .select("id")
        .whereRef("cover_media_id", "=", "m.id"),
    ),
  ]);

export const hasCatalogMediaReferenceData = (db: Database, id: string) =>
  db
    .selectFrom("media_assets as m")
    .select("m.id")
    .where("m.id", "=", id)
    .where(catalogMediaHasReference)
    .executeTakeFirst();
