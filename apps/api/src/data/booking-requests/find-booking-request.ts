import { bookingRevision } from "./booking-revision.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const findBookingRequestData = (
  db: Database,
  id: string,
  customerId?: string,
) => {
  let query = db
    .selectFrom("booking_requests")
    .selectAll().select(bookingRevision.as("revision"))
    .where("id", "=", id);
  if (customerId) query = query.where("customer_id", "=", customerId);
  return query.executeTakeFirst();
};
