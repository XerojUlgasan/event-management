import { sql, type Kysely, type SqlBool, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function findCatalogTitleData(
  db: Kysely<DB> | Transaction<DB>,
  table: "packages" | "services",
  title: { name: string; slug: string },
  exceptId?: string,
) {
  let query = db
    .selectFrom(table)
    .select("id")
    .where(
      sql<SqlBool>`(lower(name) = ${title.name.toLowerCase()} or slug = ${title.slug})`,
    );
  if (table === "packages")
    query = query.where(sql<SqlBool>`package_type = 'catalog'`);
  if (exceptId) query = query.where("id", "!=", exceptId);
  return query.executeTakeFirst();
}
