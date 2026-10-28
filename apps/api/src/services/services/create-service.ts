import { createServiceData } from "../../data/services/create-service.js";
import { createServiceDraftData } from "../../data/services/create-service-draft.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { serviceAdminDto } from "./service-response.js";
import { lockServiceImagesData } from "../../data/services/lock-service-images.js";
import { checkServiceImageData } from "../../data/services/check-service-image.js";
import { error } from "../packages/package-rules.js";
export async function createServiceService(db: Kysely<DB>, data: ServiceContent) { return db.transaction().execute(async trx => { await lockServiceImagesData(trx, [data.imageUrl]); if (!await checkServiceImageData(trx, data.imageUrl)) return error("Uploaded image not found", 400); const s = await createServiceData(trx); await createServiceDraftData(trx, s.id, 1, data); return serviceAdminDto(trx, s); }); }
