import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const hasPublicPackageReferenceData = (db: Database, id: string) => db.selectFrom("package_services as ps").innerJoin("service_versions as sv", "sv.id", "ps.service_version_id").innerJoin("package_versions as pv", "pv.id", "ps.package_version_id").innerJoin("packages as p", "p.id", "pv.package_id").select("ps.id").where("sv.service_id", "=", id).where("pv.state", "=", "published").where("p.archived_at", "is", null).executeTakeFirst();
