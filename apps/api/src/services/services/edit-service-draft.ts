import { createServiceDraftData } from "../../data/services/create-service-draft.js";
import { updateServiceDraftData } from "../../data/services/update-service-draft.js";
import { touchServiceData } from "../../data/services/touch-service.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { listVersionsData } from "../../data/services/list-service-versions.js";
import { error, nextUpdate } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
export async function editServiceDraftService(db: Kysely<DB>, id: string, data: ServiceContent & { expectedUpdatedAt: string }) {
 const outcome = await db.transaction().execute(async trx => { const s = await lockServiceData(trx, id); if (!s) return error("Service not found", 404); if (s.archived_at) return error("Archived services cannot be edited", 409); const current = (await listVersionsData(trx, id))[0]; if (!current || current.updated_at.toISOString() !== data.expectedUpdatedAt) return error("Service changed. Refresh and try again", 409); const now = nextUpdate(current.updated_at); if (current.state === "draft") await updateServiceDraftData(trx, current.id, data, now); else await createServiceDraftData(trx, id, current.version + 1, data, now); await touchServiceData(trx, id, now); return serviceAdminDto(trx, s); });
 return outcome;
}
