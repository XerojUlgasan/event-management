import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function listPublicPackageVersionsData(db: Database, id?: string) {
  let q = db.selectFrom("package_versions as v").innerJoin("packages as p", "p.id", "v.package_id")
    .selectAll("v").where("v.state", "=", "published").where("p.archived_at", "is", null);
  if (id) q = q.where("p.id", "=", id);
  return q.orderBy("v.published_at", "desc").execute();
}
