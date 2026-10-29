import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function updateVenueData(db: Transaction<DB>, id: string, name: string, location: string, description: string) {
  return db.updateTable("venues").set({ name, location, description, updated_at: new Date() })
    .where("id", "=", id).returningAll().executeTakeFirst();
}
