import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { lockVenueImagesData, venueImageUrl, findVenueImageData, deleteUnusedVenueImageData } from "../../data/venues/venue-images.js";
import { error } from "./venue-rules.js";
import { cleanupImagesFromR2 } from "../../utils/r2-image-storage.js";
export async function deleteVenueImageService(db: Kysely<DB>, id: string) {
 const outcome = await db.transaction().execute(async trx => {
  await lockVenueImagesData(trx,[venueImageUrl(id)]);
  if(!await findVenueImageData(trx,id)) return error("Image not found",404);
  return await deleteUnusedVenueImageData(trx,id) ?? error("Image is referenced by a venue version",409);
 });
 if (typeof outcome !== "string") return outcome;
 await cleanupImagesFromR2([outcome]);
 return null;
}
