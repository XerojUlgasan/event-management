import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function findPublicPackageBySlugData(db: Kysely<DB>, slug: string) {
  return db
    .selectFrom("packages")
    .selectAll()
    .where("package_type", "=", "catalog")
    .where("slug", "=", slug)
    .where("archived_at", "is", null)
    .executeTakeFirst();
}
