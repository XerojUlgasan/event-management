import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { addStatusHistoryData } from "../../data/booking-requests/add-status-history.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { updateBookingStatusData } from "../../data/booking-requests/update-booking-status.js";
import { error } from "./booking-request-rules.js";
import { bookingRequestDtos } from "./booking-request-response.js";
import { cancelScheduledEventDaysService } from "./cancel-scheduled-event-days.js";

export async function cancelBookingRequestService(
  db: Kysely<DB>,
  id: string,
  customerId: string,
  reason: string,
) {
  return db.transaction().execute(async (trx) => {
    const row = await lockBookingRequestData(trx, id);

    if (!row || row.customer_id !== customerId)
      return error("Booking request not found", 404);

    if (row.event_finished_at) return error("The event is finished", 409);

    if (!["under_review", "needs_details", "accepted"].includes(row.status))
      return error("Invalid status transition", 409);

    await cancelScheduledEventDaysService(trx, id);
    const updated = await updateBookingStatusData(trx, id, "cancelled");
    await addStatusHistoryData(
      trx,
      id,
      "cancelled",
      customerId,
      reason || null,
    );

    return (await bookingRequestDtos(trx, [updated]))[0]!;
  });
}
