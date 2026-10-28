import { archiveServiceData } from "../../data/services/archive-service.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { hasPublicPackageReferenceData } from "../../data/services/find-public-package-reference.js";
import { error } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
export async function archiveServiceService(db: Kysely<DB>, id: string) { return db.transaction().execute(async trx => { const s = await lockServiceData(trx, id); if (!s) return error("Service not found", 404); if (await hasPublicPackageReferenceData(trx, id)) return error("Service is used by a published package", 409); const updated = await archiveServiceData(trx, id, s.archived_at ?? new Date()); return serviceAdminDto(trx, updated); }); }
