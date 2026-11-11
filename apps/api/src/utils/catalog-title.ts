import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { sql, type Kysely, type SqlBool, type Transaction } from "kysely";
import type { DB } from "../db/types.js";

type CatalogTable = "packages" | "services" | "venues";
type Database = Kysely<DB> | Transaction<DB>;

export async function reserveCatalogTitle(
  db: Database,
  table: CatalogTable,
  name: string,
  exceptId?: string,
) {
  const trimmed = name.trim();
  const slug = catalogSlug(trimmed);
  let query = db
    .selectFrom(table)
    .select("id")
    .where(sql<SqlBool>`(lower(name) = ${trimmed.toLowerCase()} or slug = ${slug})`);
  if (table === "packages") query = query.where(sql<SqlBool>`package_type = 'catalog'`);
  if (exceptId) query = query.where("id", "!=", exceptId);
  const existing = await query.executeTakeFirst();
  return existing ? null : { name: trimmed, slug };
}

export function duplicateTitle(cause: unknown, message: string) {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: string }).code === "23505"
  ) {
    return { message, status: 409 as const };
  }
  return null;
}
