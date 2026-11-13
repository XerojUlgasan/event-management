import type { PaginationQuery } from "@event-management/contracts/pagination"
export type CatalogPageQuery = PaginationQuery & { search?: string; archived?: "all" | "active" | "archived" }
export function pageQuery(page?: CatalogPageQuery) {
  const params = new URLSearchParams()
  if (page?.limit !== undefined) params.set("limit", String(page.limit))
  if (page?.cursor) params.set("cursor", page.cursor)
  if (page?.search) params.set("search", page.search)
  if (page?.archived) params.set("archived", page.archived)
  const query = params.toString()
  return query ? `?${query}` : ""
}
