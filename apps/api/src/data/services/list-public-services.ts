import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
export function listPublicServicesData(db: Kysely<DB>, id: string) {
  let q = db
    .selectFrom("services")
    .selectAll()
    .where("archived_at", "is", null);
  q = q.where("id", "=", id);
  q = q.orderBy("published_at", "desc").orderBy("id", "desc");
  return q.execute();
}
