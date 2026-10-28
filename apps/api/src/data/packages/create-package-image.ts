import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createPackageImageData(db: Database, contentType: string, data: Buffer) {
  return db.insertInto("package_images").values({ content_type: contentType, data }).returning("id").executeTakeFirstOrThrow();
}
