import "dotenv/config";
import { db } from "../db/client.js";
import { backgroundJobSettings } from "../services/background-jobs/job-definitions.js";
import { runBackgroundJobsWorker } from "../services/background-jobs/run-worker.js";
import { waitForWorkerDelay } from "../services/background-jobs/wait-for-worker-delay.js";
import { completeEndedBookings } from "../services/booking-requests/complete-ended-bookings.js";

const controller = new AbortController();

const stop = () => controller.abort();

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function runEventCompletionChecks(signal: AbortSignal) {
  while (!signal.aborted) {
    const startedAt = performance.now();

    try {
      await completeEndedBookings(db, signal);
    } catch {
      console.error("Booking completion check failed.");
    }

    await waitForWorkerDelay(
      Math.max(0, 60_000 - (performance.now() - startedAt)),
      signal,
    );
  }
}

try {
  console.info(
    `Background job worker started (polling every ${backgroundJobSettings.pollIntervalMs} ms and checking event completion every minute).`,
  );
  const jobs = runBackgroundJobsWorker(db, { signal: controller.signal });
  const completion = runEventCompletionChecks(controller.signal);

  try {
    await Promise.all([jobs, completion]);
  } finally {
    controller.abort();
    await Promise.allSettled([jobs, completion]);
  }
} catch {
  console.error("Background job worker stopped unexpectedly.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  await db.destroy();
}
