import { createContext, useContext } from "react";

export type CatalogSelection = { entity: "package" | "service"; id: string };

export const CatalogNavigationContext = createContext<
  ((selection: CatalogSelection) => void) | undefined
>(undefined);

export function useCatalogNavigation() {
  return useContext(CatalogNavigationContext);
}
