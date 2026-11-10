import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const lockCatalogMediaData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("media_assets")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
