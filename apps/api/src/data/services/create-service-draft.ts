import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { columns } from "./service-columns.js";
export const createServiceDraftData = (db: Transaction<DB>, id: string, version: number, data: ServiceContent, updatedAt?: Date) => db.insertInto("service_versions").values({service_id:id, version, state:"draft", ...(updatedAt ? {updated_at:updatedAt} : {}), ...columns(data)}).execute();
