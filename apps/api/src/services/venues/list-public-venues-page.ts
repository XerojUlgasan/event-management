import { createPage } from "@event-management/contracts/pagination";
import { catalogFilterScope } from "@event-management/contracts/catalog-filters";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listPublicVenuesPageData } from "../../data/venues/list-public-venues-page.js";
import {
  catalogCursor,
  type CatalogListOptions,
} from "../../data/catalog/list-page.js";
import { venuePublicDto } from "./venue-response.js";

export async function listPublicVenuesPageService(
  db: Kysely<DB>,
  options: CatalogListOptions,
) {
  const scope = catalogFilterScope("venues", options);
  const { position, cursorFor } = catalogCursor(options.cursor, scope, "name");
  const rows = await listPublicVenuesPageData(db, options, position);
  const page = createPage(rows, options.limit, cursorFor);
  return {
    venues: await Promise.all(page.items.map((row) => venuePublicDto(db, row))),
    nextCursor: page.nextCursor,
  };
}
