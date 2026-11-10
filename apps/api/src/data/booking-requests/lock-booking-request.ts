import type { Transaction } from "kysely";
import { bookingRevision } from "./booking-revision.js";
import type { DB } from "../../db/types.js";

export const lockBookingRequestData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("booking_requests")
    .selectAll()
    .select(bookingRevision.as("revision"))
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
