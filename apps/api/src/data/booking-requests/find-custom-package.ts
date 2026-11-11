import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const findCustomPackageData = (db: Database, bookingId: string) => db.selectFrom("packages").selectAll().where("package_type", "=", "custom").where("custom_for_booking_request_id", "=", bookingId).executeTakeFirst();
