import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { hasAdminSessionService } from "../auth/has-admin-session.js";
import { findPublicVenueImageData, findVenueImageData } from "../../data/venues/venue-images.js";
import { imageObjectKey, type ImageContentType } from "../../utils/upload-image-to-r2.js";
import { getImageFromR2 } from "../../utils/r2-image-storage.js";
export async function getVenueImageService(db: Kysely<DB>, id: string, token?: string) {
 if (!await findPublicVenueImageData(db,id) && !await hasAdminSessionService(db,token)) return null;
 const row = await findVenueImageData(db,id);
 if (!row) return null;
 const data = await getImageFromR2(imageObjectKey("venues", row.id, row.content_type as ImageContentType));
 return data ? { data, content_type: row.content_type } : null;
}
