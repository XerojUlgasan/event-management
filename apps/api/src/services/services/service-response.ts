import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Services, ServiceVersions } from "../../db/types.js";
import { listVersionsData } from "../../data/services/list-service-versions.js";
type Database = Kysely<DB> | Transaction<DB>;
export function serviceVersionDto(v: Selectable<ServiceVersions>) { return { id: v.id, serviceId: v.service_id, version: v.version, state: v.state as "draft" | "published" | "superseded", name: v.name, categories: v.categories, description: v.description, imageUrl: v.image_url, updatedAt: v.updated_at.toISOString(), publishedAt: v.published_at?.toISOString() ?? null }; }
export async function serviceAdminDto(db: Database, s: Selectable<Services>) { const versions = (await listVersionsData(db, s.id)).map(serviceVersionDto); return { id: s.id, archivedAt: s.archived_at?.toISOString() ?? null, draft: versions.find(v => v.state === "draft") ?? null, published: versions.find(v => v.state === "published") ?? null, versions }; }
export function publicDto(v: Selectable<ServiceVersions>) { const d = serviceVersionDto(v); return { id: d.serviceId, versionId: d.id, version: d.version, name: d.name, categories: d.categories, description: d.description, imageUrl: d.imageUrl, publishedAt: d.publishedAt! }; }
