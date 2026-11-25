import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "kysely";
import {
  workerTokenHeader,
  type EdgeJobWorker,
} from "../constants/edge-job-workers.js";
import { db } from "../db/client.js";
import { startOneBackgroundJob } from "../services/background-jobs/run-one-background-job.js";

// Hosted Supabase and its local Edge runtime supply the background task API.
declare const EdgeRuntime: { waitUntil(work: Promise<void>): void };

const tokenPattern = /^(\d{1,12})\.([0-9a-f]{64})$/;

export async function runEdgeJobRequest(
  request: Request,
  worker: EdgeJobWorker,
) {
  const token = tokenPattern.exec(request.headers.get(workerTokenHeader) ?? "");

  const unauthorized = () =>
    Response.json({ error: "Invalid worker token" }, { status: 401 });

  if (!token) return unauthorized();

  const [, timestamp, signature] = token;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);

  if (age < -5 || age > 30) return unauthorized();

  try {
    const deadline = AbortSignal.timeout(125_000);
    const secret = await sql<{ decrypted_secret: string }>`
      select decrypted_secret from vault.decrypted_secrets
      where name = ${worker.secret}
    `.execute(db);
    const expected = secret.rows[0]?.decrypted_secret;

    if (!expected) return unauthorized();

    const expectedSignature = createHmac("sha256", expected)
      .update(timestamp)
      .digest();

    if (!timingSafeEqual(Buffer.from(signature, "hex"), expectedSignature))
      return unauthorized();

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
