import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export const listCustomPackageHistoryData = (db: Database, bookingId: string) => db.selectFrom("audit_events").select(["id", "actor_id", "action", "metadata", "created_at"]).where("entity_type", "=", "booking_request").where("entity_id", "=", bookingId).where("action", "in", ["booking.custom_package_created", "booking.custom_package_updated"]).orderBy("created_at", "desc").orderBy("id", "desc").execute();
