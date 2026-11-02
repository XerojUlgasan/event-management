import type { Selectable } from "kysely";
import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { Packages } from "../../db/types.js";
import {
  readPackageSectionsData,
  type Database,
} from "../../data/packages/catalog-page.js";
export async function packageDto(
  db: Database,
  row: Selectable<Packages>,
): Promise<CatalogPackage> {
  const sections = await readPackageSectionsData(db, row.id);
  const widgets = sections.flatMap((section) => section.widgets);
  return {
    id: row.id,
    name: row.name,
    eventTypes: row.event_types,
    guestMax: row.guest_max,
    price: { kind: "fixed", currency: "PHP", amountMinor: row.price * 100 },
    sections,
    description: row.description,
    imageUrl:
      widgets.find((widget) => widget.type === "photo" && widget.media)?.media
        ?.url ?? null,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at.toISOString(),
  };
}
