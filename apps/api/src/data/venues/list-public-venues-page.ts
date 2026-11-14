import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type {
  CatalogListOptions,
  CatalogPosition,
} from "../catalog/list-page.js";

type Database = Kysely<DB> | Transaction<DB>;
export function listPublicVenuesPageData(
  db: Database,
  options: CatalogListOptions,
  position?: CatalogPosition,
) {
  let query = db
    .selectFrom("venues")
    .selectAll()
    .select(sql<string>`name`.as("page_sort"));
  query = query.where("archived_at", "is", null);
  if (options.guests !== undefined)
    query = query.where("max_guests", ">=", options.guests);
  if (position)
    query = query.where(
      sql<boolean>`(name, id) > (${position.sort}, ${position.id}::uuid)`,
    );
  return query
    .orderBy("name", "asc")
    .orderBy("id", "asc")
    .limit(options.limit + 1)
    .execute();
}
