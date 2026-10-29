import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createVenueImageData, venueImageUrl } from "../../data/venues/venue-images.js";
export async function uploadVenueImageService(db: Kysely<DB>, type: string, data: Buffer) { return venueImageUrl((await createVenueImageData(db, type, data)).id); }
