import { bookingRevision } from "./booking-revision.js";
import type { Transaction, Insertable } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";

export const createBookingRequestData = (
  db: Transaction<DB>,
  values: Insertable<BookingRequests>,
) =>
  db
    .insertInto("booking_requests")
    .values(values)
    .returningAll()
    .returning(bookingRevision.as("revision"))
    .executeTakeFirstOrThrow();
