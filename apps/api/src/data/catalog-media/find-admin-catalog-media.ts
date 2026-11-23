import { sql } from "kysely";
import { anyCatalogOwnerContainsMedia } from "./canvas-reference.js";
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
        anyCatalogOwnerContainsMedia(sql.ref("m.id")),
      ]),
    )
    .executeTakeFirst();
