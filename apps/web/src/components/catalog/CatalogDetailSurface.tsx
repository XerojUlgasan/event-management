import { Button } from "@event-management/ui";
import type { ReactNode } from "react";

export function CatalogDetailSurface({
  catalog,
  onBack,
  backLabel = `All ${catalog}`,
  children,
}: {
  catalog: "packages" | "services";
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  const label = catalog === "packages" ? "Package catalog" : "Service catalog";

  return (
    <div className="public-catalog-detail">
      <div className="public-catalog-detail-shell">
        <nav className="section-back" aria-label={label}>
          {onBack ? (
            <Button
              variant="plain"
              className="catalog-detail-back"
              onClick={onBack}
            >
              {backLabel}
            </Button>
          ) : (
            <a href={`/${catalog}`}>All {catalog}</a>
          )}
        </nav>
        {children}
      </div>
    </div>
  );
}
