import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { findServiceData } from "../../data/services/find-service.js";
import { error } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
export async function getAdminServiceService(db: Kysely<DB>, id: string) { const s = await findServiceData(db, id); return s ? serviceAdminDto(db, s) : error("Service not found", 404); }
