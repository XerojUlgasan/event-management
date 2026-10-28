import { deleteServiceData } from "../../data/services/delete-service.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { listVersionsData } from "../../data/services/list-service-versions.js";
import { error } from "../packages/package-rules.js";
import { lockServiceImagesData } from "../../data/services/lock-service-images.js";
import { deleteUnusedServiceImageData } from "../../data/services/delete-unused-service-image.js";
export async function deleteServiceService(db: Kysely<DB>, id: string) { try { return await db.transaction().execute(async trx => { const s = await lockServiceData(trx, id); if (!s) return error("Service not found", 404); const versions = await listVersionsData(trx, id); if (versions.some(v => v.published_at)) return error("Published services cannot be deleted; archive instead", 409); await lockServiceImagesData(trx, versions.map(v => v.image_url)); await deleteServiceData(trx, id); for (const v of versions) await deleteUnusedServiceImageData(trx, v.image_url); return null; }); } catch (cause) { if ((cause as {code?:string}).code === "23503") return error("Referenced services cannot be deleted; archive instead", 409); throw cause; } }
