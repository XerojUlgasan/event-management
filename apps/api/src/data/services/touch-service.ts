import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
export const touchServiceData = (db: Transaction<DB>, id: string, now: Date) => db.updateTable("services").set({updated_at:now}).where("id", "=", id).execute();
