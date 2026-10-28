import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
export function listPublicServiceVersionsData(db: Kysely<DB>, id?: string, page?: { limit: number; offset: number }) { let q = db.selectFrom("service_versions as v").innerJoin("services as s", "s.id", "v.service_id").selectAll("v").where("v.state", "=", "published").where("s.archived_at", "is", null); if (id) q = q.where("s.id", "=", id); q = q.orderBy("v.published_at", "desc").orderBy("v.id", "desc"); if (page) q = q.limit(page.limit).offset(page.offset); return q.execute(); }
