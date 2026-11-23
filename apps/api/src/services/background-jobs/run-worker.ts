import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { backgroundJobSettings } from "./job-definitions.js";
import {
  runOneBackgroundJob,
  type WorkerOptions,
} from "./run-one-background-job.js";
import { waitForWorkerDelay } from "./wait-for-worker-delay.js";

export async function runBackgroundJobsWorker(
  db: Kysely<DB>,
  options: WorkerOptions,
): Promise<void> {
  const concurrency = options.concurrency ?? backgroundJobSettings.concurrency;
  const pollIntervalMs =
    options.pollIntervalMs ?? backgroundJobSettings.pollIntervalMs;

  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    pollIntervalMs < 1 ||
    (options.leaseMs ?? backgroundJobSettings.leaseMs) <=
      (options.heartbeatMs ?? backgroundJobSettings.heartbeatMs) ||
    (options.heartbeatMs ?? backgroundJobSettings.heartbeatMs) < 1
  )
    throw new Error("Invalid worker settings");

  const active = new Set<Promise<void>>();

  while (!options.signal.aborted) {
    while (active.size < concurrency && !options.signal.aborted) {
      // Claim one at a time so no more than the available slots are leased.
      const started = runOneBackgroundJob(db, options);
      let task: Promise<void>;
      task = started
        .then((claimed) => {
          if (!claimed) return;
        })
        .catch(() => {
          // Database errors may contain private values; do not log their details.
          console.error("Background job worker operation failed");
        })
        .finally(() => active.delete(task));
      active.add(task);
      // Avoid spinning on an empty queue: each slot is checked at most once per poll.
    }

    await waitForWorkerDelay(pollIntervalMs, options.signal);
  }

  await Promise.all(active);
}
