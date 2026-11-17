import { createContext, useContext } from "react";

export const ServiceNavigationContext = createContext<
  ((id: string) => void) | undefined
>(undefined);

export function useServiceNavigation() {
  return useContext(ServiceNavigationContext);
}
