import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { addStatusHistoryData } from "../../data/booking-requests/add-status-history.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { updateBookingStatusData } from "../../data/booking-requests/update-booking-status.js";
import { createNotificationData } from "../../data/notifications/create-notification.js";
import { error } from "./booking-request-rules.js";
import { bookingRequestDtos } from "./booking-request-response.js";
import { cancelScheduledEventDaysService } from "./cancel-scheduled-event-days.js";

export async function updateBookingStatusService(
  db: Kysely<DB>,
  id: string,
  actorId: string,
  status: Status,
  reason?: string | null,
) {
  return db.transaction().execute(async (trx) => {
    const row = await lockBookingRequestData(trx, id);

    if (!row) return error("Booking request not found", 404);

    if (row.status === "finished") return error("The event is finished", 409);

    if (
      ["declined", "cancelled"].includes(row.status) ||
      row.status === status ||
      status === "under_review" ||
      status === "finished"
    )
      return error("Invalid status transition", 409);

    if (status === "cancelled") await cancelScheduledEventDaysService(trx, id);

    const updated = await updateBookingStatusData(trx, id, status);
    const event = await addStatusHistoryData(
      trx,
      id,
      status,
      actorId,
      reason || null,
    );

    if (row.customer_id !== actorId)
      await createNotificationData(trx, { userId: row.customer_id }, event.id, {
        type: "booking_status_updated",
        payload: {
          bookingRequestId: id,
          bookingReference: row.reference,
          status,
        },
      });

    return (await bookingRequestDtos(trx, [updated]))[0]!;
  });
}
