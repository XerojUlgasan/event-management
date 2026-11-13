import type { APIRoute } from "astro"
import { loadAllCatalog, loadPackagesPage, loadServicesPage, loadVenuesPage } from "../lib/server/catalog"

export const GET: APIRoute = async ({ url }) => {
  let paths = ["/", "/about", "/packages", "/services", "/venues"]
  try {
    const [packages, services, venues] = await Promise.all([loadAllCatalog(loadPackagesPage), loadAllCatalog(loadServicesPage), loadAllCatalog(loadVenuesPage)])
    paths = [
      ...paths,
      ...packages.map((item) => `/packages/${item.slug}`),
      ...services.map((item) => `/services/${item.slug}`),
      ...venues.map((item) => `/venues/${item.slug}`),
    ]
  } catch {
    // The collection paths remain available when the catalog API is down.
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((path) => `<url><loc>${new URL(path, url).href}</loc></url>`)
    .join("\n")}\n</urlset>\n`
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } })
}
