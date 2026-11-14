import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type {
  CatalogListOptions,
  CatalogPosition,
} from "../catalog/list-page.js";

type Database = Kysely<DB> | Transaction<DB>;
export function listPublicPackagesPageData(
  db: Database,
  options: CatalogListOptions,
  position?: CatalogPosition,
) {
  let query = db
    .selectFrom("packages")
    .selectAll()
    .where("package_type", "=", "catalog")
    .select(
      sql<string>`to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
        "page_sort",
      ),
    );
  query = query.where("archived_at", "is", null);
  if (position)
    query = query.where(
      sql<boolean>`(published_at, id) < (${position.sort}::timestamptz, ${position.id}::uuid)`,
    );
  return query
    .orderBy("published_at", "desc")
    .orderBy("id", "desc")
    .limit(options.limit + 1)
    .execute();
}
