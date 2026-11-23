import { utcTimestampSql } from "../../utils/sql-page.js";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function readBookingDraftCatalog(
  trx: Transaction<DB>,
  packageId: string | undefined,
  serviceIds: string[],
  lock: boolean,
) {
  let packageQuery = trx
    .selectFrom("packages")
    .select(["id", "name", "price", "max_guests", "updated_at", "canvas"])
    .select(utcTimestampSql("updated_at").as("revision"))
    .where("package_type", "=", "catalog")
    .where("archived_at", "is", null)
    .where("published_at", "is not", null);
  let serviceQuery = trx
    .selectFrom("services")
    .select(["id", "name"])
    .select(utcTimestampSql("updated_at").as("revision"))
    .where("archived_at", "is", null)
    .orderBy("id");

  if (lock) {
    packageQuery = packageQuery.forUpdate();
    serviceQuery = serviceQuery.forUpdate();
  }

  const pkg = packageId
    ? await packageQuery.where("id", "=", packageId).executeTakeFirst()
    : undefined;
  const rows = serviceIds.length
    ? await serviceQuery.where("id", "in", serviceIds).execute()
    : [];

  return { pkg, services: new Map(rows.map((row) => [row.id, row])) };
}
