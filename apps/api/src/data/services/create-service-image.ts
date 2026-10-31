import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createServiceImageData(db: Database, id: string, contentType: string) {
  return db.insertInto("service_images").values({ id, content_type: contentType }).returning("id").executeTakeFirstOrThrow();
}
