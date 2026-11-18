import { NotificationProvider } from "@event-management/ui";
import { PublicCatalog } from "../../catalog/PublicCatalog";
import type { CatalogKind } from "@event-management/contracts/catalog-filters";

/**
 * Wraps PublicCatalog in a NotificationProvider for use on public Astro pages.
 * Both must share the same React root — a single client:only mount point.
 */
export function PublicCatalogPage({ kind }: { kind: CatalogKind }) {
  return (
    <NotificationProvider>
      <PublicCatalog
        kind={kind}
        mode="overview"
        showFilters={true}
        allowBooking={false}
      />
    </NotificationProvider>
  );
}
