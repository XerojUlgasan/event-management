import type { Kysely } from "kysely";
import { addStatusHistoryData } from "../../data/booking-requests/add-status-history.js";
import {
  listDueEventCompletionCandidatesData,
  liveEventDaysHaveEndedData,
} from "../../data/booking-requests/event-completion.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { updateBookingStatusData } from "../../data/booking-requests/update-booking-status.js";
import { createNotificationData } from "../../data/notifications/create-notification.js";
import type { DB } from "../../db/types.js";

const candidatePageSize = 100;

export async function completeEndedBookings(
  db: Kysely<DB>,
  signal?: AbortSignal,
) {
  let afterId: string | undefined;

  while (!signal?.aborted) {
    const candidates = await listDueEventCompletionCandidatesData(
      db,
      afterId,
      candidatePageSize,
    );

    for (const { id } of candidates) {
      if (signal?.aborted) return;

      try {
        await db.transaction().execute(async (trx) => {
          const booking = await lockBookingRequestData(trx, id);

          if (
            signal?.aborted ||
            booking?.status !== "accepted" ||
            !(await liveEventDaysHaveEndedData(trx, id))
          )
            return;

          await updateBookingStatusData(trx, id, "finished");
          await addStatusHistoryData(trx, id, "finished", null, null);
          const notification = {
            type: "event_finished",
            payload: {
              bookingRequestId: id,
              bookingReference: booking.reference,
            },
          } as const;
          await createNotificationData(trx, { role: "admin" }, id, notification);
          await createNotificationData(
            trx,
            { userId: booking.customer_id },
            id,
            notification,
          );
        });
      } catch {
        // Continue the sweep. This booking stays eligible for the next attempt.
        console.error("Unable to finish booking.");
      }
    }

    if (candidates.length < candidatePageSize) return;

    afterId = candidates.at(-1)?.id;
  }
}
