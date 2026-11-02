import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { VenueContent } from "../../controllers/venues/schemas.js";
export function venueColumns(input: VenueContent) { return { name: input.name.trim(), location: input.location.trim(), description: input.description.trim(), categories: input.categories.map(v => v.trim()), capacity_max: input.capacityMax, image_urls: input.imageUrls }; }
export function createVenueData(db: Transaction<DB>, input: VenueContent) { return db.insertInto("venues").values(venueColumns(input)).returningAll().executeTakeFirstOrThrow(); }
