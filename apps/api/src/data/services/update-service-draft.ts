import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { columns } from "./service-columns.js";
export const updateServiceDraftData = (db: Transaction<DB>, id: string, data: ServiceContent, now: Date) => db.updateTable("service_versions").set({...columns(data), updated_at:now}).where("id", "=", id).execute();
