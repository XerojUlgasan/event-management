import { packageAddonServicesSchema } from "@event-management/contracts/catalog-service-terms";
import {
  listCanvasServicesData,
  readPackageAddonServicesData,
} from "../../data/catalog-canvas/catalog-canvas-queries.js";
import { canvasReference } from "../../utils/catalog-canvas.js";
import { pesosToCentavos } from "@event-management/contracts/money";
import type { Selectable } from "kysely";
import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { Packages } from "../../db/types.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";
import type { Database } from "../../data/catalog-canvas/catalog-canvas-types.js";

export async function packageDto(db: Database, row: Selectable<Packages>) {
  const sections = await readCatalogSectionsService(db, {
    kind: "package",
    id: row.id,
  });
  const stored = await readPackageAddonServicesData(db, row.id);
  const addons = packageAddonServicesSchema.parse(stored.addon_services);

  const services = await listCanvasServicesData(
    db,
    addons.map((addon) => addon.serviceId),
  );

  const previews = new Map(
    services.map((service) => [service.id, canvasReference(service)]),
  );

  const addonServices = addons.map((addon) => ({
    ...addon,
    service: previews.get(addon.serviceId) ?? null,
  }));

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
    addonServices,
    description: row.description,
    imageUrl: thumbnailUrl,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
  } satisfies CatalogPackage;
}
