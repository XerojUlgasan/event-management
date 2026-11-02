import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;
export async function lockServiceImages(
  db: Transaction<DB>,
  ids: (string | null)[],
) {
  const uniqueIds = [
    ...new Set(ids.filter((id): id is string => id !== null)),
  ].sort();
  for (const id of uniqueIds)
    await sql`select pg_advisory_xact_lock(hashtextextended(${`service-image:${id}`}, 0))`.execute(
      db,
    );
}
export async function hasServiceImageReference(db: Database, id: string) {
  return !!(await db
    .selectFrom("services")
    .select("id")
    .where("image_id", "=", id)
    .limit(1)
    .executeTakeFirst());
}
