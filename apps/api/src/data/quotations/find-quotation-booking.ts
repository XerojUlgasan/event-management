import { selectSubmittedBookings } from "../booking-requests/select-submitted-bookings.js";
import { type Database } from "./quotation-revision.js";

export const findQuotationBookingData = (db: Database, id: string) =>
  selectSubmittedBookings(db)
    .where("id", "=", id)
    .executeTakeFirst();
