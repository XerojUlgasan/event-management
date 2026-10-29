import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { lockVenueImagesData, venueImageUrl, findVenueImageData, deleteUnusedVenueImageData } from "../../data/venues/venue-images.js";
import { error } from "./venue-rules.js";
export async function deleteVenueImageService(db: Kysely<DB>, id: string) { return db.transaction().execute(async trx => {await lockVenueImagesData(trx,[venueImageUrl(id)]); if(!await findVenueImageData(trx,id)) return error("Image not found",404); if(!await deleteUnusedVenueImageData(trx,id)) return error("Image is referenced by a venue version",409); return null;}); }
