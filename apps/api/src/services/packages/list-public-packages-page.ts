import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listPublicPackagesPageData } from "../../data/packages/list-public-packages-page.js";
import { catalogCursor, type CatalogListOptions } from "../../data/catalog/list-page.js";
import { packageDto } from "./package-response.js";

export async function listPublicPackagesPageService(db: Kysely<DB>, options: CatalogListOptions) {
  const scope = "packages:public";
  const { position, cursorFor } = catalogCursor(options.cursor, scope);
  return db.transaction().setIsolationLevel("repeatable read").execute(async trx => {
    const rows = await listPublicPackagesPageData(trx, options, position);
    const page = createPage(rows, options.limit, cursorFor);
    return { packages: await Promise.all(page.items.map(row => packageDto(trx, row))), nextCursor: page.nextCursor };
  });
}
