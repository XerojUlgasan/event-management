import { timingSafeEqual } from "node:crypto";
import { sql } from "kysely";
import {
  catalogIndexJobTypes,
  catalogIndexWorkerSecret,
  catalogIndexWorkerTokenHeader,
} from "../constants/catalog-index-worker.js";
import { db } from "../db/client.js";
import { runOneBackgroundJob } from "../services/background-jobs/run-one-background-job.js";

const tokenPattern = /^[0-9a-f]{64}$/;

export async function runCatalogIndexRequest(request: Request) {
  const token = request.headers.get(catalogIndexWorkerTokenHeader);

  const unauthorized = () =>
    Response.json({ error: "Invalid worker token" }, { status: 401 });

  if (!token || !tokenPattern.test(token)) return unauthorized();

  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(125_000),
    ]);
    const secret = await sql<{ decrypted_secret: string }>`
      select decrypted_secret from vault.decrypted_secrets
      where name = ${catalogIndexWorkerSecret}
    `.execute(db);
    const expected = secret.rows[0]?.decrypted_secret;

    if (
      !expected ||
      !tokenPattern.test(expected) ||
      !timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"))
    )
      return unauthorized();

    const claimed = await runOneBackgroundJob(db, {
      signal,
      jobTypes: catalogIndexJobTypes,
    });

    return Response.json({ claimed });
  } catch {
    console.error("Catalog index worker invocation failed.");

    return Response.json(
      { error: "Catalog index worker unavailable" },
      { status: 503 },
    );
  }
}
