import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function listBookingPackagesData(
  db: Kysely<DB> | Transaction<DB>,
  packageIds: string[],
) {
  if (!packageIds.length) return Promise.resolve([]);

  return db
    .selectFrom("packages")
    .select(["id", "name", "price", "max_guests"])
    .where("id", "in", packageIds)
    .execute();
}
