import { deleteServiceData } from "../../data/services/delete-service.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { listVersionsData } from "../../data/services/list-service-versions.js";
import { cleanupServiceImage } from "./cleanup-service-image.js";
import { error } from "../packages/package-rules.js";
export async function deleteServiceService(db: Kysely<DB>, id: string) {
 try {
  let images: (string | null)[] = [];
  const outcome = await db.transaction().execute(async trx => {
   const s = await lockServiceData(trx, id); if (!s) return error("Service not found", 404);
   const versions = await listVersionsData(trx, id);
   if (versions.some(v => v.published_at)) return error("Published services cannot be deleted; archive instead", 409);
   images = versions.map(v => v.image_id);
   await deleteServiceData(trx, id);
   return null;
  });
  if (!outcome) for (const url of new Set(images)) await cleanupServiceImage(db, url);
  return outcome;
 } catch (cause) {
  if ((cause as {code?:string}).code === "23503") return error("Referenced services cannot be deleted; archive instead", 409);
  throw cause;
 }
}
