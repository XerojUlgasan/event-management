import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listPublicServicesPageData } from "../../data/services/list-public-services-page.js";
import {
  catalogCursor,
  type CatalogListOptions,
} from "../../data/catalog/list-page.js";
import { publicDto } from "./service-response.js";

export async function listPublicServicesPageService(
  db: Kysely<DB>,
  options: CatalogListOptions,
) {
  const scope = "services:public";
  const { position, cursorFor } = catalogCursor(options.cursor, scope);
  const rows = await listPublicServicesPageData(db, options, position);
  const page = createPage(rows, options.limit, cursorFor);
  return {
    services: await Promise.all(page.items.map((row) => publicDto(db, row))),
    nextCursor: page.nextCursor,
  };
}
