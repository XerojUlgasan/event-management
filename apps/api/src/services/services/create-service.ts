import { createServiceData } from "../../data/services/create-service.js";
import { createServiceDraftData } from "../../data/services/create-service-draft.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { serviceAdminDto } from "./service-response.js";
export async function createServiceService(db: Kysely<DB>, data: ServiceContent) { return db.transaction().execute(async trx => { const s = await createServiceData(trx); await createServiceDraftData(trx, s.id, 1, data); return serviceAdminDto(trx, s); }); }
