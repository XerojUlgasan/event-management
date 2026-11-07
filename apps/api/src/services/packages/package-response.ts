import type { Selectable } from "kysely";
import type { CatalogPackage, PackageServiceRole } from "@event-management/contracts/catalog";
import type { Packages } from "../../db/types.js";
import {
  readPackageSectionsData,
  type Database,
} from "../../data/packages/catalog-page.js";
import { listPackageServicesData } from "../../data/packages/package-services.js";
export async function packageDto(
  db: Database,
  row: Selectable<Packages>,
  options?: { includeArchivedServices?: boolean },
): Promise<CatalogPackage> {
  const [sections, services] = await Promise.all([
    readPackageSectionsData(db, row.id),
    listPackageServicesData(db, [row.id]),
  ]);
  const widgets = sections.flatMap((section) => section.widgets);
  return {
    id: row.id,
    packageType: row.package_type as "catalog" | "custom",
    customForBookingRequestId: row.custom_for_booking_request_id,
    name: row.name,
    maxGuests: row.max_guests,
    price: { kind: "fixed", currency: "PHP", amountMinor: row.price * 100 },
    sections,
    services: services
      .filter(
        (service) =>
          options?.includeArchivedServices || service.archived_at === null,
      )
      .map((service) => ({
        serviceId: service.service_id,
        name: service.name,
        role: service.role as PackageServiceRole,
        sortOrder: service.sort_order,
        archivedAt: service.archived_at?.toISOString() ?? null,
      })),
    description: row.description,
    imageUrl:
      widgets.find((widget) => widget.type === "photo" && widget.media)?.media
        ?.url ?? null,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}
