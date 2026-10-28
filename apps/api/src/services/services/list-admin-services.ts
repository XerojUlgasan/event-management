import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listServicesData } from "../../data/services/list-services.js";
import { serviceAdminDto } from "./service-response.js";
export async function listAdminServicesService(db: Kysely<DB>) { return Promise.all((await listServicesData(db)).map(s => serviceAdminDto(db, s))); }
