import { pesosToCentavos } from "@event-management/contracts/money";
import type { Selectable } from "kysely";
import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { Packages } from "../../db/types.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";
import type { Database } from "../../data/catalog-canvas/catalog-canvas-types.js";

export async function packageDto(
  db: Database,
  row: Selectable<Packages>,
): Promise<CatalogPackage> {
  const sections = await readCatalogSectionsService(db, {
    kind: "package",
    id: row.id,
  });
  const thumbnailUrl = row.thumbnail_media_id
    ? `/v1/catalog-media/${row.thumbnail_media_id}`
    : null;

  return {
    id: row.id,
    slug: row.slug,
    packageType: row.package_type as "catalog" | "custom",
    customForBookingRequestId: row.custom_for_booking_request_id,
    name: row.name,
    maxGuests: row.max_guests,
    price: {
      kind: "fixed",
      currency: "PHP",
      amountMinor: pesosToCentavos(row.price),
    },
    sections,
    description: row.description,
    imageUrl: thumbnailUrl,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}
