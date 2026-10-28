import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function listIncludingPackagesData(db: Kysely<DB>, serviceId: string) {
  return db.selectFrom("package_versions as v")
    .innerJoin("packages as p", "p.id", "v.package_id")
    .selectAll("v")
    .where("v.state", "=", "published")
    .where("p.archived_at", "is", null)
    .where(eb => eb.exists(
      eb.selectFrom("package_services as ps")
        .innerJoin("service_versions as sv", "sv.id", "ps.service_version_id")
        .select("ps.id")
        .whereRef("ps.package_version_id", "=", "v.id")
        .where("sv.service_id", "=", serviceId)
        .where("ps.role", "=", "included"),
    ))
    .orderBy("v.published_at", "desc")
    .orderBy("v.id", "desc")
    .execute();
}
