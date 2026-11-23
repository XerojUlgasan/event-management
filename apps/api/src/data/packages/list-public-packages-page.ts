import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";
import type {
  CatalogListOptions,
  CatalogPosition,
} from "../../utils/catalog-pagination.js";

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
    .select(utcTimestampSql("published_at").as("page_sort"));
  query = query.where("archived_at", "is", null);

  if (options.minPricePesos !== undefined)
    query = query.where("price", ">=", options.minPricePesos);

  if (options.maxPricePesos !== undefined)
    query = query.where("price", "<=", options.maxPricePesos);

  if (options.guests !== undefined)
    query = query.where("max_guests", ">=", options.guests);

  if (options.eventType !== undefined)
    query = query.where("event_type", "=", options.eventType);

  if (position)
    query = query.where(
      keysetPredicate("published_at", "id", position.sort, position.id, "<"),
    );

  return query
    .orderBy("published_at", "desc")
    .orderBy("id", "desc")
    .limit(options.limit + 1)
    .execute();
}
