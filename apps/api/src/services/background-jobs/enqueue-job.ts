import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { enqueueJobData } from "../../data/background-jobs/queue.js";
import {
  jobDefinitions,
  type BackgroundJobPayload,
  type BackgroundJobType,
} from "./job-definitions.js";

export function enqueueBackgroundJobService<T extends BackgroundJobType>(
  trx: Transaction<DB>,
  type: T,
  payload: BackgroundJobPayload<T>,
) {
  const parsed = jobDefinitions[type].parse(payload);
  return enqueueJobData(trx, type, parsed.payload, parsed.key);
}
