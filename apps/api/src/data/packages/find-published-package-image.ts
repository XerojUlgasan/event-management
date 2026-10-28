import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findPublishedPackageImageData(db: Database, id: string) {
  return db.selectFrom("package_versions as v").innerJoin("packages as p", "p.id", "v.package_id").select("v.id")
    .where("v.image_url", "=", `/v1/package-images/${id}`).where("v.state", "=", "published").where("p.archived_at", "is", null).executeTakeFirst();
}
