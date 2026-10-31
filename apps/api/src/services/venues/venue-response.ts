import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Venues, VenueVersions } from "../../db/types.js";
import { listVenueVersionsData } from "../../data/venues/list-venues.js";
type Database = Kysely<DB> | Transaction<DB>;
export function venueVersionDto(row: Selectable<VenueVersions>) {
 return { id: row.id, venueId: row.venue_id, version: row.version, state: row.state as "draft" | "published" | "superseded", name: row.name, location: row.location, description: row.description, categories: row.categories, capacityMin: row.capacity_min, capacityMax: row.capacity_max, imageUrls: row.image_urls, updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null };
}
export async function venueAdminDto(db: Database, venue: Selectable<Venues>) {
 const versions = (await listVenueVersionsData(db, venue.id)).map(venueVersionDto);
 return { id: venue.id, archivedAt: venue.archived_at?.toISOString() ?? null, draft: versions.find(v => v.state === "draft") ?? null, published: versions.find(v => v.state === "published") ?? null, versions };
}
export async function venuePublicDto(db: Database, row: Selectable<VenueVersions> & { venue_created_at: Date; venue_updated_at: Date }) {
 const v = venueVersionDto(row);
 return { id: v.venueId, versionId: v.id, version: v.version, name: v.name, location: v.location, description: v.description, categories: v.categories, capacityMin: v.capacityMin, capacityMax: v.capacityMax, imageUrls: v.imageUrls, publishedAt: v.publishedAt!, createdAt: row.venue_created_at.toISOString(), updatedAt: row.venue_updated_at.toISOString(), archivedAt: null };
}
