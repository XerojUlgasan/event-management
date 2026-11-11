import { bookingRevision } from "../booking-requests/booking-revision.js";
import { type Database } from "./quotation-revision.js";

export const findQuotationBookingData = (db: Database, id: string) =>
  db
    .selectFrom("booking_requests")
    .selectAll()
    .select(bookingRevision.as("revision"))
    .where("id", "=", id)
    .executeTakeFirst();
