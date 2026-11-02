import { listPublicServicesData } from "../../data/services/list-public-services.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { publicDto } from "./service-response.js";
export async function listPublicServicesService(db: Kysely<DB>, id?: string, page?: { limit: number; offset: number }) { return Promise.all((await listPublicServicesData(db, id, page)).map(v => publicDto(db, v))); }
