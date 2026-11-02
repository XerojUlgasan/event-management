import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { VenueContent } from "../../controllers/venues/schemas.js";
import { venueColumns } from "./create-venue.js";
export function updateVenueData(db: Transaction<DB>, id: string, input: VenueContent, now: Date) { return db.updateTable("venues").set({ ...venueColumns(input), updated_at: now }).where("id", "=", id).returningAll().executeTakeFirstOrThrow(); }
