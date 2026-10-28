import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findServiceImageData(db: Database, id: string) {
  return db.selectFrom("service_images").select(["data", "content_type"]).where("id", "=", id).executeTakeFirst();
}
