import { bookingRevision } from "./booking-revision.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const listBookingRequestsData = (db: Database, customerId?: string) => {
  let query = db.selectFrom("booking_requests").selectAll().select(bookingRevision.as("revision"));
  if (customerId) query = query.where("customer_id", "=", customerId);
  return query.orderBy("created_at", "desc").orderBy("id", "desc").execute();
};
