import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { enqueueJobData } from "../../data/background-jobs/enqueue-job.js";
import { ensureJobScheduledData } from "../../data/background-jobs/ensure-job-scheduled.js";
import { enqueueNewBackgroundJobsData } from "../../data/background-jobs/enqueue-new-jobs.js";
import {
  jobDefinitions,
  type BackgroundJobPayload,
  type BackgroundJobType,
} from "./job-definitions.js";

/** Enqueue jobs for freshly inserted owners with distinct keys. */
export async function enqueueNewBackgroundJobsService<
  T extends BackgroundJobType,
>(trx: Transaction<DB>, type: T, payloads: BackgroundJobPayload<T>[]) {
  if (!payloads.length) return;

  const jobs = payloads.map((payload) => {
    const parsed = jobDefinitions[type].parse(payload);

    return { type, dedupe_key: parsed.key, payload: parsed.payload };
  });

  await enqueueNewBackgroundJobsData(trx, jobs);
}

export function enqueueBackgroundJobService<T extends BackgroundJobType>(
  trx: Transaction<DB>,
  type: T,
  payload: BackgroundJobPayload<T>,
) {
  const parsed = jobDefinitions[type].parse(payload);

  return enqueueJobData(trx, type, parsed.payload, parsed.key);
}

export function ensureBackgroundJobScheduledService<
  T extends BackgroundJobType,
>(trx: Transaction<DB>, type: T, payload: BackgroundJobPayload<T>) {
  const parsed = jobDefinitions[type].parse(payload);

  return ensureJobScheduledData(trx, type, parsed.payload, parsed.key);
}
