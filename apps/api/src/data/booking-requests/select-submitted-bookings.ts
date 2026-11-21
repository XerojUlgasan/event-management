import type { Kysely, NotNull } from "kysely";
import type { DB } from "../../db/types.js";
import { bookingRevision } from "./booking-revision.js";

// booking_requests_submitted_fields_check guarantees these values after submission.
export function selectSubmittedBookings(db: Kysely<DB>) {
  return db
    .selectFrom("booking_requests")
    .where("submitted_at", "is not", null)
    .selectAll()
    .select(bookingRevision.as("revision"))
    .$narrowType<{
      submitted_at: NotNull;
      customer_id: NotNull;
      event_type: NotNull;
      preferred_date: NotNull;
      time_zone: NotNull;
      contact_name: NotNull;
      phone_number: NotNull;
    }>();
}
