import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { VenueContent } from "../../controllers/venues/schemas.js";
export function venueColumns(input: VenueContent) { return { name: input.name.trim(), location: input.location.trim(), description: input.description.trim(), max_guests: input.maxGuests }; }
export function createVenueData(db: Transaction<DB>, input: VenueContent) { return db.insertInto("venues").values(venueColumns(input)).returningAll().executeTakeFirstOrThrow(); }
