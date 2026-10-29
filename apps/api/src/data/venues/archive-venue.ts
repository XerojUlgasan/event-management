import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function archiveVenueData(db: Transaction<DB>, id: string) {
  return db.updateTable("venues").set({ archived_at: new Date(), updated_at: new Date() })
    .where("id", "=", id).returningAll().executeTakeFirst();
}
