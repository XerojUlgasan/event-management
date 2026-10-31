import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { randomUUID } from "node:crypto";
import { createVenueImageData, venueImageUrl } from "../../data/venues/venue-images.js";
import { uploadImageToR2, type ImageContentType } from "../../utils/upload-image-to-r2.js";
import { cleanupImagesFromR2 } from "../../utils/r2-image-storage.js";
export async function uploadVenueImageService(db: Kysely<DB>, type: string, data: Buffer) {
 const id = randomUUID();
 const key = await uploadImageToR2("venues", data, type as ImageContentType, id);
 try { await createVenueImageData(db, id, type); }
 catch (cause) { await cleanupImagesFromR2([key]); throw cause; }
 return venueImageUrl(id);
}
