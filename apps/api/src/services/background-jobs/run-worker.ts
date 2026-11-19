import { setTimeout as sleep } from "node:timers/promises";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  claimJobData,
  finishJobData,
  heartbeatJobData,
} from "../../data/background-jobs/queue.js";
import {
  backgroundJobPolicies,
  backgroundJobSettings,
  executeJob,
  isBackgroundJobType,
  jobDefinitions,
  type BackgroundJobType,
} from "./job-definitions.js";

type WorkerOptions = {
  signal: AbortSignal;
  // Injection is limited to execution and timings for deterministic tests.
  execute?: (
    type: BackgroundJobType,
    payload: unknown,
    db: Kysely<DB>,
    signal: AbortSignal,
  ) => Promise<void>;
  pollIntervalMs?: number;
  concurrency?: number;
  leaseMs?: number;
  heartbeatMs?: number;
  timeoutMs?: number;
};

async function wait(ms: number, signal: AbortSignal) {
  try {
    await sleep(ms, undefined, { signal });
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}

export async function runOneBackgroundJob(
  db: Kysely<DB>,
  options: WorkerOptions,
): Promise<boolean> {
  if (options.signal.aborted) return false;
  const leaseMs = options.leaseMs ?? backgroundJobSettings.leaseMs;
  const heartbeatMs = options.heartbeatMs ?? backgroundJobSettings.heartbeatMs;
  const job = await claimJobData(db, leaseMs, backgroundJobPolicies);
  if (!job || !isBackgroundJobType(job.type)) return false;
  const type = job.type;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  const timeout = setTimeout(
    abort,
    options.timeoutMs ?? jobDefinitions[type].timeoutMs,
  );
  const heartbeatStop = new AbortController();
  let ownershipLost = false;
  const heartbeat = (async () => {
    while (!heartbeatStop.signal.aborted) {
      await wait(heartbeatMs, heartbeatStop.signal);
      if (heartbeatStop.signal.aborted) break;
      try {
        if (!(await heartbeatJobData(db, job, leaseMs))) {
          ownershipLost = true;
          abort();
          break;
        }
      } catch {
        ownershipLost = true;
        abort();
        break;
      }
    }
  })();
  let outcome: "success" | "retry" | "invalid" = "retry";
  try {
    // Validate persisted JSON even when tests inject a handler.
    const parsed = jobDefinitions[type].payloadSchema.safeParse(job.payload);
    if (!parsed.success) outcome = "invalid";
    else {
      controller.signal.throwIfAborted();
      // Abort bounds worker ownership even when a buggy handler ignores the signal.
      // Handlers must still honor the signal before making external writes.
      let onAbort: (() => void) | undefined;
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error("Job aborted"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        if (controller.signal.aborted) onAbort();
      });
      try {
        await Promise.race([
          Promise.resolve().then(() => {
            controller.signal.throwIfAborted();
            return (options.execute ?? executeJob)(
              type,
              parsed.data,
              db,
              controller.signal,
            );
          }),
          aborted,
        ]);
      } finally {
        if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      }
      controller.signal.throwIfAborted();
      outcome = "success";
    }
  } catch (error) {
    // Handler failures are retryable; provider details are deliberately discarded.
  } finally {
    clearTimeout(timeout);
    heartbeatStop.abort();
    await heartbeat;
    options.signal.removeEventListener("abort", abort);
  }
  if (!ownershipLost)
    await finishJobData(db, job, outcome, backgroundJobPolicies);
  return true;
}

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
    await wait(pollIntervalMs, options.signal);
  }
  await Promise.all(active);
}
