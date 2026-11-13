import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listAdminVenuesPageData, countAdminVenuesData } from "../../data/venues/list-admin-venues-page.js";
import { catalogCursor, type CatalogListOptions } from "../../data/catalog/list-page.js";
import { venueAdminDto } from "./venue-response.js";

export async function listAdminVenuesPageService(db: Kysely<DB>, options: CatalogListOptions) {
  const scope = `venues:admin:${options.archived ?? "all"}:${options.search ?? ""}`;
  const { position, cursorFor } = catalogCursor(options.cursor, scope);
  const [rows, counts] = await Promise.all([listAdminVenuesPageData(db, options, position), countAdminVenuesData(db, options)]);
  const page = createPage(rows, options.limit, cursorFor);
  return { venues: await Promise.all(page.items.map(row => venueAdminDto(db, row))), nextCursor: page.nextCursor, counts };
}
