import type { PaginationQuery } from "./pagination.js";

export type CatalogKind = "packages" | "services";
export type ServicePricingType = "fixed" | "hourly";
export const EVENT_TYPES = [
  "Birthday",
  "Wedding",
  "Debut",
  "Corporate",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type CatalogFilters = {
  minPricePesos?: number;
  maxPricePesos?: number;
  guests?: number;
  pricingType?: ServicePricingType;
  eventType?: EventType;
};
export type PublicCatalogPageQuery = PaginationQuery & CatalogFilters;
export const MAX_CATALOG_FILTER_PRICE_PESOS = 2147483647;
export const MAX_CATALOG_FILTER_GUESTS = 2147483647;

/** Keep unfiltered cursors compatible and bind filtered cursors to their query. */
export function catalogFilterScope(kind: CatalogKind, filters: CatalogFilters) {
  const values = [
    filters.minPricePesos,
    filters.maxPricePesos,
    filters.guests,
    filters.eventType,
  ];
  if (kind === "services" && filters.pricingType !== undefined)
    return `${kind}:public:${JSON.stringify([...values, filters.pricingType])}`;
  return values.every((value) => value === undefined)
    ? `${kind}:public`
    : `${kind}:public:${JSON.stringify(values)}`;
}
