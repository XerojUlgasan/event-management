import "dotenv/config";
import { db } from "../db/client.js";
import { backgroundJobSettings } from "../services/background-jobs/job-definitions.js";
import { runBackgroundJobsWorker } from "../services/background-jobs/run-worker.js";

const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  console.info(
    `Background job worker started (polling every ${backgroundJobSettings.pollIntervalMs} ms).`,
  );
  await runBackgroundJobsWorker(db, { signal: controller.signal });
} catch {
  console.error("Background job worker stopped unexpectedly.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  await db.destroy();
}
