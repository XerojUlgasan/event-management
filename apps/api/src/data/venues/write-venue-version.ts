import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
import type { VenueContent } from "../../controllers/venues/schemas.js";
export function venueColumns(input: VenueContent) { return { name: input.name.trim(), location: input.location.trim(), description: input.description.trim(), categories: input.categories.map(v => v.trim()), capacity_min: input.capacityMin, capacity_max: input.capacityMax, image_urls: input.imageUrls }; }
export function createVenueDraftData(db: Transaction<DB>, id: string, version: number, input: VenueContent, now = new Date()) { return db.insertInto("venue_versions").values({ venue_id: id, version, state: "draft", ...venueColumns(input), updated_at: now }).returningAll().executeTakeFirstOrThrow(); }
export function updateVenueDraftData(db: Transaction<DB>, id: string, input: VenueContent, now: Date) { return db.updateTable("venue_versions").set({ ...venueColumns(input), updated_at: now }).where("id", "=", id).execute(); }
export async function publishVenueDraftData(db: Transaction<DB>, venueId: string, versionId: string, now: Date) {
 await db.updateTable("venue_versions").set({ state: "superseded" }).where("venue_id", "=", venueId).where("state", "=", "published").execute();
 await db.updateTable("venue_versions").set({ state: "published", published_at: now, updated_at: now }).where("id", "=", versionId).execute();
}
