import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import {
  catalogTextMatch,
  keysetPredicate,
  utcTimestampSql,
} from "../../utils/sql-page.js";
import type {
  CatalogListOptions,
  CatalogPosition,
} from "../../utils/catalog-pagination.js";

type Database = Kysely<DB> | Transaction<DB>;
export function listAdminServicesPageData(
  db: Database,
  options: CatalogListOptions,
  position?: CatalogPosition,
) {
  let query = db
    .selectFrom("services")
    .selectAll()
    .select(
      utcTimestampSql("created_at").as("page_sort"),
    );
  if (options.archived === "active")
    query = query.where("archived_at", "is", null);
  if (options.archived === "archived")
    query = query.where("archived_at", "is not", null);
  if (options.search)
    query = query.where(catalogTextMatch(options.search));
  if (position)
    query = query.where(
      keysetPredicate(
        "created_at",
        "id",
        position.sort,
        position.id,
        "<",
      ),
    );
  return query
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(options.limit + 1)
    .execute();
}

export async function countAdminServicesData(
  db: Database,
  options: CatalogListOptions,
) {
  const result = await db
    .selectFrom("services")
    .select(
      sql<string>`count(*) filter (where archived_at is null)`.as("active"),
    )
    .select(
      sql<string>`count(*) filter (where archived_at is not null)`.as(
        "archived",
      ),
    )
    .executeTakeFirstOrThrow();
  let matching = db.selectFrom("services");
  if (options.archived === "active")
    matching = matching.where("archived_at", "is", null);
  if (options.archived === "archived")
    matching = matching.where("archived_at", "is not", null);
  if (options.search)
    matching = matching.where(catalogTextMatch(options.search));
  const filtered = await matching
    .select(sql<string>`count(*)`.as("count"))
    .executeTakeFirstOrThrow();
  return {
    active: Number(result.active),
    archived: Number(result.archived),
    filtered: Number(filtered.count),
  };
}
