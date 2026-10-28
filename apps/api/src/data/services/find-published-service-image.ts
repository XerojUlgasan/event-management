import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function findPublishedServiceImageData(db: Database, id: string) {
  const url = `/v1/service-images/${id}`;
  const service = await db.selectFrom("service_versions as v").innerJoin("services as s", "s.id", "v.service_id").select("v.id")
    .where("v.image_url", "=", url).where("v.state", "=", "published").where("s.archived_at", "is", null).executeTakeFirst();
  if (service) return service;
  return db.selectFrom("service_versions as v")
    .innerJoin("package_services as assignment", "assignment.service_version_id", "v.id")
    .innerJoin("package_versions as pv", "pv.id", "assignment.package_version_id")
    .innerJoin("packages as p", "p.id", "pv.package_id")
    .select("v.id").where("v.image_url", "=", url).where("pv.state", "=", "published").where("p.archived_at", "is", null).executeTakeFirst();
}
