import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function listPublicPackageVersionsData(db: Database, id?: string, page?: { limit: number; offset: number }) {
  let q = db.selectFrom("package_versions as v").innerJoin("packages as p", "p.id", "v.package_id")
    .selectAll("v").where("v.state", "=", "published").where("p.archived_at", "is", null);
  if (id) q = q.where("p.id", "=", id);
  q = q.orderBy("v.published_at", "desc").orderBy("v.id", "desc");
  if (page) q = q.limit(page.limit).offset(page.offset);
  return q.execute();
}
