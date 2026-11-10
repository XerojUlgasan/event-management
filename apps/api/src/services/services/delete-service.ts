import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { deleteServiceData } from "../../data/services/delete-service.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { error } from "../packages/package-rules.js";
import { listCatalogMediaIdsData } from "../../data/packages/catalog-page.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
export async function deleteServiceService(db: Kysely<DB>, id: string) {
 let media: string[] = [];
 try { const outcome = await db.transaction().execute(async trx => {
  const row = await lockServiceData(trx, id); if (!row) return error("Service not found", 404);
  media = await listCatalogMediaIdsData(trx, { kind: "service", id });
  await deleteServiceData(trx, id); return null;
 });
 if (!outcome) { await cleanupCatalogMediaService(db, media); } return outcome;
 } catch (cause) { if ((cause as {code?:string}).code === "23503") return error("Referenced services cannot be deleted; archive instead", 409); throw cause; }
}
