import type { Database } from "./catalog-page.js";
export function listPublicPackagesData(
  db: Database,
  id?: string,
  page?: { limit: number; offset: number },
) {
  let query = db
    .selectFrom("packages")
    .selectAll().where("package_type", "=", "catalog")
    .where("archived_at", "is", null);
  if (id) query = query.where("id", "=", id);
  if (page) query = query.limit(page.limit).offset(page.offset);
  return query.orderBy("published_at", "desc").orderBy("id", "desc").execute();
}
