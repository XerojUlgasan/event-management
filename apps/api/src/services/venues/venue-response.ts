import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Venues } from "../../db/types.js";
import { readCatalogSectionsData } from "../../data/packages/catalog-page.js";
type Database = Kysely<DB> | Transaction<DB>;
export async function venueAdminDto(db: Database, venue: Selectable<Venues>) {
 return { sections: await readCatalogSectionsData(db, { kind: "venue", id: venue.id }), id: venue.id, name: venue.name, location: venue.location, description: venue.description, categories: venue.categories, capacityMax: venue.capacity_max, imageUrls: venue.image_urls, publishedAt: venue.published_at.toISOString(), createdAt: venue.created_at.toISOString(), updatedAt: venue.updated_at.toISOString(), archivedAt: venue.archived_at?.toISOString() ?? null };
}
export const venuePublicDto = venueAdminDto;
