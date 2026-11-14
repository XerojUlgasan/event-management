import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function findPublicServiceBySlugData(db: Kysely<DB>, slug: string) {
  return db
    .selectFrom("services")
    .selectAll()
    .where("slug", "=", slug)
    .where("archived_at", "is", null)
    .executeTakeFirst();
}
