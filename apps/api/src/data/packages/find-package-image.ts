import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findPackageImageData(db: Database, id: string) {
  return db.selectFrom("package_images").select(["id", "content_type"]).where("id", "=", id).executeTakeFirst();
}
