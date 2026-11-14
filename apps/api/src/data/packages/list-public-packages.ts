import type { Database } from "./catalog-page.js";
export function listPublicPackagesData(db: Database, id: string) {
  let query = db
    .selectFrom("packages")
    .selectAll()
    .where("package_type", "=", "catalog")
    .where("archived_at", "is", null);
  query = query.where("id", "=", id);
  return query.orderBy("published_at", "desc").orderBy("id", "desc").execute();
}
