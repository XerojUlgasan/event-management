import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  listAdminPackagesPageData,
  countAdminPackagesData,
} from "../../data/packages/list-admin-packages-page.js";
import {
  catalogCursor,
  type CatalogListOptions,
} from "../../utils/catalog-pagination.js";
import { packageDto } from "./package-response.js";

export async function listAdminPackagesPageService(
  db: Kysely<DB>,
  options: CatalogListOptions,
) {
  const scope = `packages:admin:${options.archived ?? "all"}:${options.search ?? ""}`;
  const { position, cursorFor } = catalogCursor(options.cursor, scope);
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const [rows, counts] = await Promise.all([
        listAdminPackagesPageData(trx, options, position),
        countAdminPackagesData(trx, options),
      ]);
      const page = createPage(rows, options.limit, cursorFor);
      return {
        packages: await Promise.all(
          page.items.map((row) => packageDto(trx, row)),
        ),
        nextCursor: page.nextCursor,
        counts,
      };
    });
}
