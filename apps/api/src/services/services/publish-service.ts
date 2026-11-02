import { touchServiceData } from "../../data/services/touch-service.js";
import { supersedeServiceVersionsData } from "../../data/services/supersede-service-versions.js";
import { publishServiceDraftData } from "../../data/services/publish-service-draft.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { listVersionsData } from "../../data/services/list-service-versions.js";
import { error, nextUpdate } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
export async function publishServiceService(db: Kysely<DB>, id: string, expected: string) { return db.transaction().execute(async trx => { const s = await lockServiceData(trx, id); if (!s) return error("Service not found", 404); if (s.archived_at) return error("Archived services cannot be published", 409); const draft = (await listVersionsData(trx, id)).find(v => v.state === "draft"); if (!draft) return error("No draft to publish", 409); if (draft.updated_at.toISOString() !== expected) return error("Service changed. Refresh and try again", 409); if (![draft.name, draft.description].every(x => x.trim()) || draft.hourly_rate_pesos === null || draft.image_id === null) return error("Complete service details before publishing", 400); const now = nextUpdate(draft.updated_at); await supersedeServiceVersionsData(trx, id); await publishServiceDraftData(trx, draft.id, now); await touchServiceData(trx, id, now); return serviceAdminDto(trx, s); }); }
