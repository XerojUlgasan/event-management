import type { Kysely } from "kysely";
import { markEventFinishedData } from "../../data/booking-requests/event-completion.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { createNotificationData } from "../../data/notifications/create-notification.js";
import type { DB } from "../../db/types.js";
import { bookingRequestDtos } from "./booking-request-response.js";
import { error } from "./booking-request-rules.js";
import { isEventCompletionEligible } from "./event-completion-eligibility.js";

export function finishEventService(
  db: Kysely<DB>,
  id: string,
  adminId: string,
  expectedUpdatedAt: string,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, id);

    if (!booking) return error("Booking request not found", 404);

    if (booking.event_finished_at)
      return (await bookingRequestDtos(trx, [booking]))[0]!;

    if (
      !booking.event_ready_at ||
      booking.revision !== expectedUpdatedAt ||
      !(await isEventCompletionEligible(trx, booking))
    )
      return error(
        "The event is no longer ready to finish. Refresh and review its schedule.",
        409,
      );

    const finished = await markEventFinishedData(trx, id, adminId);
    await createNotificationData(trx, { userId: booking.customer_id }, id, {
      type: "event_finished",
      payload: { bookingRequestId: id, bookingReference: booking.reference },
    });

    return (await bookingRequestDtos(trx, [finished]))[0]!;
  });
}
