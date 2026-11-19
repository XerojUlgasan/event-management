import { useId } from "react";
import type { CatalogKind } from "@event-management/contracts/catalog-filters";
import { PageHeader, Tabs } from "@event-management/ui";
import { customerPaths } from "../../../app/routes";
import { navigateWorkspace } from "../../../../lib/navigation/workspace-navigation";
import { PublicCatalog } from "../../../catalog/PublicCatalog";

export function CustomerCatalogPage({ search }: { search: string }) {
  const id = useId();
  const value = new URLSearchParams(search).get("catalog");
  const kind: CatalogKind =
    value === "services" ? value : "packages";

  const items = [
    { value: "packages", label: "Packages" },
    { value: "services", label: "Services" },
  ].map((item) => ({
    ...item,
    id: `${id}-${item.value}-tab`,
    panelId: `${id}-${item.value}-panel`,
  }));

  return (
    <div className="customer-content customer-catalog">
      <PageHeader
        title="Catalogs"
        description="Find a package or explore services for your event."
      />
      <Tabs
        role="tablist"
        aria-label="Catalog categories"
        active={kind}
        items={items}
        onChange={(next) =>
          navigateWorkspace(`${customerPaths.Catalogs}?catalog=${next}`)
        }
      />
      {items.map((item) => (
        <div
          key={item.value}
          role="tabpanel"
          id={item.panelId}
          aria-labelledby={item.id}
          hidden={item.value !== kind}
          tabIndex={0}
        >
          {item.value === kind && (
            <PublicCatalog key={kind} kind={kind} mode="overview" showFilters />
          )}
        </div>
      ))}
    </div>
  );
}
