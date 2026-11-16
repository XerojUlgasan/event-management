import type { PublicCatalogPageQuery } from "@event-management/contracts/catalog-filters";
export type CatalogPageQuery = PublicCatalogPageQuery & {
  search?: string;
  archived?: "all" | "active" | "archived";
};
export function pageQuery(page?: CatalogPageQuery) {
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set("limit", String(page.limit));
  if (page?.cursor) params.set("cursor", page.cursor);
  if (page?.search) params.set("search", page.search);
  if (page?.archived) params.set("archived", page.archived);
  if (page?.minPricePesos !== undefined)
    params.set("minPricePesos", String(page.minPricePesos));
  if (page?.maxPricePesos !== undefined)
    params.set("maxPricePesos", String(page.maxPricePesos));
  if (page?.guests !== undefined) params.set("guests", String(page.guests));
  if (page?.pricingType !== undefined)
    params.set("pricingType", page.pricingType);
  const query = params.toString();
  return query ? `?${query}` : "";
}
