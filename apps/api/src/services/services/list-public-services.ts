import { listPublicServiceVersionsData } from "../../data/services/list-public-service-versions.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { publicDto } from "./service-response.js";
export async function listPublicServicesService(db: Kysely<DB>, id?: string, page?: { limit: number; offset: number }) { return (await listPublicServiceVersionsData(db, id, page)).map(publicDto); }
