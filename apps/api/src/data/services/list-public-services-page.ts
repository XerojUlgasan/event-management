import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";
import type {
  CatalogListOptions,
  CatalogPosition,
} from "../../utils/catalog-pagination.js";

type Database = Kysely<DB> | Transaction<DB>;

export function listPublicServicesPageData(
  db: Database,
  options: CatalogListOptions,
  position?: CatalogPosition,
) {
  let query = db
    .selectFrom("services")
    .selectAll()
    .select(
      utcTimestampSql("published_at").as("page_sort"),
    );
  query = query.where("archived_at", "is", null);

  if (options.pricingType === "fixed")
    query = query.where("fixed_price_pesos", "is not", null);

  if (options.pricingType === "hourly")
    query = query.where("fixed_price_pesos", "is", null);

  const priceColumn =
    options.pricingType === "fixed" ? "fixed_price_pesos" : "hourly_rate_pesos";

  if (options.minPricePesos !== undefined)
    query = query.where(priceColumn, ">=", options.minPricePesos);

  if (options.maxPricePesos !== undefined)
    query = query.where(priceColumn, "<=", options.maxPricePesos);

  if (position)
    query = query.where(
      keysetPredicate(
        "published_at",
        "id",
        position.sort,
        position.id,
        "<",
      ),
    );

  return query
    .orderBy("published_at", "desc")
    .orderBy("id", "desc")
    .limit(options.limit + 1)
    .execute();
}
