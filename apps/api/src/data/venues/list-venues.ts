import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function findPublishedVenueData(db: Database, id: string) {
  return db
    .selectFrom("venues")
    .selectAll()
    .where("id", "=", id)
    .where("archived_at", "is", null)
    .executeTakeFirst();
}
export function findPublishedVenueBySlugData(db: Database, slug: string) {
  return db
    .selectFrom("venues")
    .selectAll()
    .where("slug", "=", slug)
    .where("archived_at", "is", null)
    .executeTakeFirst();
}
