import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
export const publishServiceDraftData = (db: Transaction<DB>, id: string, now: Date) => db.updateTable("service_versions").set({state:"published", published_at:now, updated_at:now}).where("id", "=", id).execute();
