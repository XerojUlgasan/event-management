import type { Selectable } from "kysely";
import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { EventType } from "@event-management/contracts/catalog-filters";
import type { Packages } from "../../db/types.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";
import type { Database } from "../../data/catalog-canvas/catalog-canvas-types.js";
import { listPackageServicesData } from "../../data/packages/package-services.js";
export async function packageDto(
  db: Database,
  row: Selectable<Packages>,
  options?: { includeArchivedServices?: boolean },
): Promise<CatalogPackage> {
  const [sections, services] = await Promise.all([
    readCatalogSectionsService(db, { kind: "package", id: row.id }),
    listPackageServicesData(db, [row.id]),
  ]);
  const widgets = sections.flatMap((section) => section.widgets);
  const thumbnailUrl = row.thumbnail_media_id
    ? `/v1/catalog-media/${row.thumbnail_media_id}`
    : null;
  const canvasPhotoUrl =
    widgets.find((widget) => widget.type === "photo" && widget.media)?.media
      ?.url ?? null;
  return {
    id: row.id,
    slug: row.slug,
    packageType: row.package_type as "catalog" | "custom",
    customForBookingRequestId: row.custom_for_booking_request_id,
    services: services
      .filter(
        (service) => options?.includeArchivedServices || !service.archived_at,
      )
      .map((service) => ({
        serviceId: service.service_id,
        name: service.name,
        role: service.role as "included" | "optional",
        sortOrder: service.sort_order,
        archivedAt: service.archived_at?.toISOString() ?? null,
      })),
    name: row.name,
    maxGuests: row.max_guests,
    price: { kind: "fixed", currency: "PHP", amountMinor: row.price * 100 },
    sections,
    description: row.description,
    imageUrl: thumbnailUrl ?? canvasPhotoUrl,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
    eventType: (row.event_type as EventType | null) ?? null,
  };
}
