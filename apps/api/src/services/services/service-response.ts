import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Services } from "../../db/types.js";
import type { EventType } from "@event-management/contracts/catalog-filters";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function serviceAdminDto(db: Database, s: Selectable<Services>) {
  const sections = await readCatalogSectionsService(db, {
    kind: "service",
    id: s.id,
  });
  const thumbnailUrl = s.thumbnail_media_id
    ? `/v1/catalog-media/${s.thumbnail_media_id}`
    : null;

  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    hourlyRatePesos: s.hourly_rate_pesos,
    fixedPricePesos: s.fixed_price_pesos,
    includedHours: s.included_hours,
    description: s.description,
    imageUrl: thumbnailUrl,
    sections,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
    archivedAt: s.archived_at?.toISOString() ?? null,
    publishedAt: s.published_at.toISOString(),
    eventType: (s.event_type as EventType | null) ?? null,
  };
}

export const publicDto = serviceAdminDto;
