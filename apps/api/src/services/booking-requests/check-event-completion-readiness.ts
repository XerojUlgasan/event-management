import type { Kysely } from "kysely";
import {
  listDueEventCompletionCandidatesData,
  markEventReadyData,
} from "../../data/booking-requests/event-completion.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { createNotificationData } from "../../data/notifications/create-notification.js";
import type { DB } from "../../db/types.js";
import { isEventCompletionEligible } from "./event-completion-eligibility.js";

const candidatePageSize = 100;

export async function checkEventCompletionReadiness(
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
            !booking ||
            booking.event_ready_at ||
            booking.event_finished_at ||
            !(await isEventCompletionEligible(trx, booking))
          )
            return;

          await markEventReadyData(trx, id);
          await createNotificationData(trx, { role: "admin" }, id, {
            type: "event_ready_to_finish",
            payload: {
              bookingRequestId: id,
              bookingReference: booking.reference,
            },
          });
        });
      } catch {
        // Continue the sweep. This booking stays eligible for the next attempt.
        console.error("Unable to save event completion readiness.");
      }
    }

    if (candidates.length < candidatePageSize) return;

    afterId = candidates.at(-1)?.id;
  }
}
