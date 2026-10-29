import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const venueImageId = (url: string) => url.slice("/v1/venue-images/".length).toLowerCase();
export function venueImageUrl(id: string) { return `/v1/venue-images/${id}`; }
export function venuePhotosData(db: Database, id: string) { return db.selectFrom("venue_version_photos").select("image_id").where("venue_version_id", "=", id).orderBy("position").execute(); }
export async function lockVenueImagesData(db: Transaction<DB>, urls: string[]) {
 for (const id of [...new Set(urls.map(venueImageId))].sort()) await db.selectFrom("venue_images").select("id").where("id", "=", id).forUpdate().executeTakeFirst();
}
export async function checkVenueImagesData(db: Transaction<DB>, urls: string[]) {
 if (!urls.length) return true;
 const rows = await db.selectFrom("venue_images").select("id").where("id", "in", urls.map(venueImageId)).execute();
 return rows.length === urls.length;
}
export async function replaceVenuePhotosData(db: Transaction<DB>, id: string, urls: string[]) {
 await db.deleteFrom("venue_version_photos").where("venue_version_id", "=", id).execute();
 if (urls.length) await db.insertInto("venue_version_photos").values(urls.map((url, position) => ({venue_version_id: id, image_id: venueImageId(url), position}))).execute();
}
export async function deleteUnusedVenueImageData(db: Transaction<DB>, id: string) {
 if (await db.selectFrom("venue_version_photos").select("image_id").where("image_id", "=", id).executeTakeFirst()) return false;
 await db.deleteFrom("venue_images").where("id", "=", id).execute(); return true;
}
export function createVenueImageData(db: Database, contentType: string, data: Buffer) { return db.insertInto("venue_images").values({ content_type: contentType, data }).returning("id").executeTakeFirstOrThrow(); }
export function findVenueImageData(db: Database, id: string) { return db.selectFrom("venue_images").selectAll().where("id", "=", id).executeTakeFirst(); }
export function findPublicVenueImageData(db: Database, id: string) { return db.selectFrom("venue_version_photos as photo").innerJoin("venue_versions as version", "version.id", "photo.venue_version_id").innerJoin("venues as venue", "venue.id", "version.venue_id").select("photo.image_id").where("photo.image_id", "=", id).where("version.state", "=", "published").where("venue.archived_at", "is", null).executeTakeFirst(); }
