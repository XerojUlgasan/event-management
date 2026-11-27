import { sql } from "kysely";
import {
  workerVersion,
  workerVersionHeader,
  type EdgeJobWorker,
} from "../constants/edge-job-workers.js";
import { db } from "../db/client.js";
import { verifyWorkerToken } from "./worker-auth.js";
import { startOneBackgroundJob } from "../services/background-jobs/run-one-background-job.js";

// Hosted Supabase and its local Edge runtime supply the background task API.
declare const EdgeRuntime: { waitUntil(work: Promise<void>): void };

export async function runEdgeJobRequest(
  request: Request,
  worker: EdgeJobWorker,
) {
  const unauthorized = () =>
    Response.json(
      { error: "Invalid worker token" },
      { status: 401, headers: { [workerVersionHeader]: workerVersion } },
    );

  try {
    const valid = await verifyWorkerToken(
      request.headers,
      worker,
      async (name) => {
        const secret = await sql<{ decrypted_secret: string }>`
        select decrypted_secret from vault.decrypted_secrets where name = ${name}
      `.execute(db);

        return secret.rows[0]?.decrypted_secret;
      },
    );

    if (!valid) return unauthorized();

    const deadline = AbortSignal.timeout(125_000);
    request.signal.throwIfAborted();
    const background =
      typeof EdgeRuntime !== "undefined" &&
      typeof EdgeRuntime.waitUntil === "function";
    const started = await startOneBackgroundJob(db, {
      signal: background
        ? deadline
        : AbortSignal.any([request.signal, deadline]),
      jobTypes: worker.jobTypes,
    });

    if (!started) return Response.json({ claimed: false });

    if (background) {
      // Release pg_net as soon as the database lease is held. The response can
      // close while heartbeat, domain writes and queue completion continue.
      EdgeRuntime.waitUntil(
        started.completion.catch(() => {
          console.error(`Worker completion failed for ${worker.scheduleName}.`);
        }),
      );
    } else {
      await started.completion;
    }

    return Response.json({ claimed: true });
  } catch {
    console.error(`Worker invocation failed for ${worker.scheduleName}.`);

    return Response.json({ error: "Worker unavailable" }, { status: 503 });
  }
}
