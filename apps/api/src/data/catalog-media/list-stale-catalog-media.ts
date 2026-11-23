import { catalogMediaHasReference } from "./has-catalog-media-reference.js";
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
    .where((eb) => eb.not(catalogMediaHasReference(eb)))
    .orderBy("m.created_at")
    .orderBy("m.id")
    .limit(limit)
    .execute();
