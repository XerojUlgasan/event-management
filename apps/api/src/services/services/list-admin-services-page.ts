import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  listAdminServicesPageData,
  countAdminServicesData,
} from "../../data/services/list-admin-services-page.js";
import {
  catalogCursor,
  type CatalogListOptions,
} from "../../utils/catalog-pagination.js";
import { serviceAdminDto } from "./service-response.js";

export async function listAdminServicesPageService(
  db: Kysely<DB>,
  options: CatalogListOptions,
) {
  const scope = `services:admin:${options.archived ?? "all"}:${options.search ?? ""}`;
  const { position, cursorFor } = catalogCursor(options.cursor, scope);
  const [rows, counts] = await Promise.all([
    listAdminServicesPageData(db, options, position),
    countAdminServicesData(db, options),
  ]);
  const page = createPage(rows, options.limit, cursorFor);
  return {
    services: await Promise.all(
      page.items.map((row) => serviceAdminDto(db, row)),
    ),
    nextCursor: page.nextCursor,
    counts,
  };
}
