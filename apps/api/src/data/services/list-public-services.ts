import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
export function listPublicServicesData(db: Kysely<DB>, id?: string, page?: { limit: number; offset: number }) { let q = db.selectFrom("services").selectAll().where("archived_at", "is", null); if (id) q = q.where("id", "=", id); q = q.orderBy("published_at", "desc").orderBy("id", "desc"); if (page) q = q.limit(page.limit).offset(page.offset); return q.execute(); }
