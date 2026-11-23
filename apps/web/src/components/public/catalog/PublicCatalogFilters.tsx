import type {
  CatalogFilters,
  CatalogKind,
} from "@event-management/contracts/catalog-filters";
import { Icon } from "@event-management/ui";
import { CatalogFiltersForm } from "../../catalog/CatalogFiltersForm";

export function PublicCatalogFilters({
  kind,
  filters,
  count,
}: {
  kind: CatalogKind;
  filters: CatalogFilters;
  count: number;
}) {
  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined,
  );
  return (
    <div className="catalog-browser public-catalog-filters">
      <div className="catalog-toolbar">
        <p className="catalog-results-summary">
          {count > 0
            ? `Showing ${count} ${kind}${hasFilters ? " matching your filters" : ""}`
            : ""}
        </p>
      </div>
      <details open={hasFilters} suppressHydrationWarning>
        <summary
          className="button button-secondary button-size-icon catalog-filter-toggle"
          aria-label={`Filter ${kind}`}
          title={`Filter ${kind}`}
          data-active={hasFilters || undefined}
        >
          <Icon name="filter" size={17} />
        </summary>
        <CatalogFiltersForm kind={kind} filters={filters} action={`/${kind}`} />
      </details>
    </div>
  );
}
