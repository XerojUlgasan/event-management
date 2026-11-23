import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function resolveBookingPackageData(
  db: Database,
  booking: { id: string; package_id: string | null },
) {
  const custom = await db
    .selectFrom("packages")
    .selectAll()
    .where("package_type", "=", "custom")
    .where("custom_for_booking_request_id", "=", booking.id)
    .executeTakeFirst();

  if (custom) return custom;

  if (!booking.package_id) return undefined;

  return db
    .selectFrom("packages")
    .selectAll()
    .where("id", "=", booking.package_id)
    .where("package_type", "=", "catalog")
    .executeTakeFirst();
}
