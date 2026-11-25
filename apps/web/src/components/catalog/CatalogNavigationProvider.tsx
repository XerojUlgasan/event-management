import { useEffect, useState, type ReactNode } from "react";
import { CatalogDetailPreview } from "./CatalogDetailPreview";
import { CatalogPreviewContent } from "./CatalogPreviewContent";
import {
  CatalogNavigationContext,
  type CatalogSelection,
} from "./catalog-navigation-context";

export function CatalogNavigationProvider({
  children,
  route,
  publicDetailLayout = false,
}: {
  children: ReactNode;
  route: string;
  publicDetailLayout?: boolean;
}) {
  const [selected, setSelected] = useState<CatalogSelection | null>(null);
  useEffect(() => {
    setSelected(null);
  }, [route]);

  return (
    <CatalogNavigationContext.Provider value={setSelected}>
      {children}
      {selected && (
        <CatalogDetailPreview
          entity={selected.entity}
          onClose={() => setSelected(null)}
          publicDetailLayout={publicDetailLayout ? "reference" : undefined}
        >
          <CatalogPreviewContent
            key={`${selected.entity}:${selected.id}`}
            selection={selected}
          />
        </CatalogDetailPreview>
      )}
    </CatalogNavigationContext.Provider>
  );
}
