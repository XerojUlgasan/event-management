import { MessageProcessingError } from "../messages/message-processing-error.js";
import type { BackgroundJobLease } from "../../data/background-jobs/assert-job-lease.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { claimJobData } from "../../data/background-jobs/claim-job.js";
import { finishJobData } from "../../data/background-jobs/finish-job.js";
import { heartbeatJobData } from "../../data/background-jobs/heartbeat-job.js";
import {
  backgroundJobPolicies,
  backgroundJobSettings,
  executeJob,
  isBackgroundJobType,
  jobDefinitions,
  type BackgroundJobType,
} from "./job-definitions.js";

import { waitForWorkerDelay } from "./wait-for-worker-delay.js";

export type WorkerOptions = {
  signal: AbortSignal;
  // Injection is limited to execution and timings for deterministic tests.
  execute?: (
    type: BackgroundJobType,
    payload: unknown,
    db: Kysely<DB>,
    signal: AbortSignal,
    lease?: BackgroundJobLease,
  ) => Promise<void>;
  pollIntervalMs?: number;
  concurrency?: number;
  leaseMs?: number;
  heartbeatMs?: number;
  timeoutMs?: number;
  jobTypes?: readonly BackgroundJobType[];
};

export async function runOneBackgroundJob(
  db: Kysely<DB>,
  options: WorkerOptions,
): Promise<boolean> {
  if (options.signal.aborted) return false;

  const leaseMs = options.leaseMs ?? backgroundJobSettings.leaseMs;
  const heartbeatMs = options.heartbeatMs ?? backgroundJobSettings.heartbeatMs;

  const policies = options.jobTypes
    ? Object.fromEntries(
        options.jobTypes.map((type) => [
          type,
          jobDefinitions[type].retryDelaysMs,
        ]),
      )
    : backgroundJobPolicies;

  const job = await claimJobData(db, leaseMs, policies);

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
      await waitForWorkerDelay(heartbeatMs, heartbeatStop.signal);

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

  let outcome: "success" | "retry" | "invalid" | "permanent" = "retry";
  let errorCode: string | undefined;

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
              { jobId: job.id, leaseToken: job.lease_token },
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
    // Persist only bounded application-owned codes; never provider details.
    if (error instanceof MessageProcessingError) {
      errorCode = error.code;

      if (error.code === "invalid_image" || error.code === "invalid_payload")
        outcome = "permanent";
    }
  } finally {
    clearTimeout(timeout);
    heartbeatStop.abort();
    await heartbeat;
    options.signal.removeEventListener("abort", abort);
  }

  if (!ownershipLost)
    await finishJobData(db, job, outcome, backgroundJobPolicies, errorCode);

  return true;
}
