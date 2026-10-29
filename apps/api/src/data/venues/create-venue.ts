import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function createVenueData(db: Transaction<DB>, name: string, location: string, description: string) {
  return db.insertInto("venues").values({ name, location, description }).returningAll().executeTakeFirstOrThrow();
}
