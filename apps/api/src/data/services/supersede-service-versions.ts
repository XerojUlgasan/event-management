import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
export const supersedeServiceVersionsData = (db: Transaction<DB>, id: string) => db.updateTable("service_versions").set({state:"superseded"}).where("service_id", "=", id).where("state", "=", "published").execute();
