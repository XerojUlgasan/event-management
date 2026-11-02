import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Services } from "../../db/types.js";
import { readCatalogSectionsData } from "../../data/packages/catalog-page.js";
type Database = Kysely<DB> | Transaction<DB>;
export async function serviceAdminDto(db: Database, s: Selectable<Services>) {
 const sections = await readCatalogSectionsData(db, { kind: "service", id: s.id });
 const photo = sections.flatMap(section => section.widgets).find(w => w.type === "photo" && w.media)?.media;
 return { id: s.id, name: s.name, hourlyRatePesos: s.hourly_rate_pesos, description: s.description, imageId: s.image_id, imageUrl: photo?.url ?? (s.image_id ? `/v1/service-images/${s.image_id}` : null), sections, createdAt: s.created_at.toISOString(), updatedAt: s.updated_at.toISOString(), archivedAt: s.archived_at?.toISOString() ?? null, publishedAt: s.published_at.toISOString() };
}
export const publicDto = serviceAdminDto;
