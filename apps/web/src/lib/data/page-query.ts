export function pageQuery(page?: { limit: number; offset?: number }) {
  return page ? `?limit=${page.limit}&offset=${page.offset ?? 0}` : ""
}
