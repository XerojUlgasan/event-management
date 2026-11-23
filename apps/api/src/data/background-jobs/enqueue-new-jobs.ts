import type { Insertable, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockBackgroundJobsData } from "./lock-background-jobs.js";

export async function enqueueNewBackgroundJobsData(
  trx: Transaction<DB>,
  jobs: Pick<
    Insertable<DB["background_jobs"]>,
    "type" | "dedupe_key" | "payload"
  >[],
) {
  await lockBackgroundJobsData(trx);
  await trx.insertInto("background_jobs").values(jobs).execute();
}
