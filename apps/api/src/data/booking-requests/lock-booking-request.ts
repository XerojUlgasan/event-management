import type { Transaction } from "kysely";
import { selectSubmittedBookings } from "./select-submitted-bookings.js";
import type { DB } from "../../db/types.js";

export const lockBookingRequestData = (db: Transaction<DB>, id: string) =>
  selectSubmittedBookings(db)
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
