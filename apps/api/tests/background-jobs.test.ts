import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../src/db/types.js";
import { claimJobData } from "../src/data/background-jobs/claim-job.js";
import { finishJobData } from "../src/data/background-jobs/finish-job.js";
import { heartbeatJobData } from "../src/data/background-jobs/heartbeat-job.js";
import {
  enqueueBackgroundJobService,
  ensureBackgroundJobScheduledService,
} from "../src/services/background-jobs/enqueue-job.js";
import {
  backgroundJobPolicies,
  backgroundJobSettings,
  jobDefinitions,
} from "../src/services/background-jobs/job-definitions.js";
import { runOneBackgroundJob } from "../src/services/background-jobs/run-one-background-job.js";
import { runBackgroundJobsWorker } from "../src/services/background-jobs/run-worker.js";
import { catalogIndexJobTypes } from "../src/constants/catalog-index-worker.js";

const database = `em_jobs_${randomUUID().replaceAll("-", "")}`;

let admin: Pool;
let db: Kysely<DB>;

const signal = new AbortController().signal;

const pkg = () => ({ packageId: randomUUID() });

const enqueue = (payload: { packageId: string }) =>
  db
    .transaction()
    .execute((trx) =>
      enqueueBackgroundJobService(trx, "embed_package", payload),
    );

async function rows() {
  return (
    await sql<{
      id: string;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
    }>`select id, status, attempts, last_error, available_at from background_jobs order by created_at, id`.execute(
      db,
    )
  ).rows;
}

async function clear() {
  await sql`delete from background_jobs`.execute(db);
}

async function due() {
  await sql`update background_jobs set available_at = clock_timestamp() - interval '1 second' where status = 'pending'`.execute(
    db,
  );
}

before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  const pool = new Pool({ ...connection, database });
  db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  const root = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }
});
after(async () => {
  await db?.destroy();

  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

test("defaults, validation, deduplication, and transaction rollback", async () => {
  assert.deepEqual(backgroundJobSettings, {
    pollIntervalMs: 3000,
    concurrency: 3,
    leaseMs: 60000,
    heartbeatMs: 20000,
  });
  assert.deepEqual(
    jobDefinitions.embed_package.retryDelaysMs,
    [10000, 60000, 300000],
  );
  assert.equal(jobDefinitions.embed_service.timeoutMs, 120000);
  assert.throws(() =>
    jobDefinitions.embed_package.payloadSchema.parse({ packageId: "bad" }),
  );
  await assert.rejects(enqueue({ packageId: "bad" }));
  const payload = pkg();
  const id = await enqueue(payload);
  assert.equal(
    await enqueue({ packageId: payload.packageId.toUpperCase() }),
    id,
  );
  assert.equal((await rows()).length, 1);
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await enqueueBackgroundJobService(trx, "embed_package", pkg());
      throw new Error("rollback");
    }),
  );
  assert.equal((await rows()).length, 1);
  await clear();
});

test("a hosted catalog invocation claims one catalog job and leaves other jobs queued", async () => {
  await db
    .insertInto("background_jobs")
    .values({ type: "process_image_message", payload: {} })
    .execute();
  const catalogJob = await enqueue(pkg());

  const options = {
    signal,
    jobTypes: catalogIndexJobTypes,
    execute: async () => {},
  };

  assert.equal(await runOneBackgroundJob(db, options), true);
  assert.equal(await runOneBackgroundJob(db, options), false);
  const records = await rows();
  assert.equal(
    records.find(({ id }) => id === catalogJob)?.status,
    "completed",
  );

  const other = records.find(({ id }) => id !== catalogJob);

  assert.equal(other?.status, "pending");
  assert.equal(other?.attempts, 0);
  await clear();
});

test("ensure scheduling preserves active retries and expired leases, then permits terminal retry", async () => {
  const payload = pkg();

  const ensure = () =>
    db
      .transaction()
      .execute((trx) =>
        ensureBackgroundJobScheduledService(trx, "embed_package", payload),
      );

  assert.deepEqual((await Promise.all([ensure(), ensure()])).sort(), [
    "already-active",
    "inserted",
  ]);
  const job = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(job);
  await finishJobData(db, job, "retry", backgroundJobPolicies);
  const before = await rows();
  assert.equal(await ensure(), "already-active");
  assert.deepEqual(await rows(), before);
  await due();
  const expired = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(expired);
  await sql`update background_jobs set lease_expires_at = clock_timestamp() - interval '1 second'`.execute(
    db,
  );
  assert.equal(await ensure(), "already-active");
  assert.equal((await rows()).length, 1);
  assert.equal(await claimJobData(db, 60000, backgroundJobPolicies), undefined);
  assert.equal((await rows())[0]?.status, "pending");
  await due();
  const final = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(final);
  await finishJobData(db, final, "permanent", backgroundJobPolicies);
  assert.equal(await ensure(), "inserted");
  assert.deepEqual(
    (await rows()).map((row) => row.status),
    ["failed", "pending"],
  );
  await clear();
});

test("claims are due, fenced, and serialized per owner with a follow-up", async () => {
  const payload = pkg();
  await enqueue(payload);
  await sql`update background_jobs set available_at = clock_timestamp() + interval '1 hour'`.execute(
    db,
  );
  assert.equal(await claimJobData(db, 60000, backgroundJobPolicies), undefined);
  await due();
  const [a, b] = await Promise.all([
    claimJobData(db, 60000, backgroundJobPolicies),
    claimJobData(db, 60000, backgroundJobPolicies),
  ]);
  const job = a ?? b;
  assert.ok(job);
  assert.equal(Number(Boolean(a)) + Number(Boolean(b)), 1);
  await enqueue(payload);
  assert.equal(await claimJobData(db, 60000, backgroundJobPolicies), undefined);
  assert.equal(
    await heartbeatJobData(db, { ...job, lease_token: randomUUID() }, 60000),
    false,
  );
  assert.equal(
    await finishJobData(
      db,
      { ...job, lease_token: randomUUID() },
      "success",
      backgroundJobPolicies,
    ),
    false,
  );
  assert.equal(
    await finishJobData(db, job, "retry", backgroundJobPolicies),
    true,
  );
  assert.deepEqual(
    (await rows()).map((r) => [r.status, r.last_error]),
    [
      ["failed", "Superseded by a newer job"],
      ["pending", null],
    ],
  );
  const successor = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(successor);
  await finishJobData(db, successor, "success", backgroundJobPolicies);
  await clear();
});

test("retry delays, exhausted attempts, and expired final lease", async () => {
  await enqueue(pkg());

  for (const delay of [10000, 60000, 300000]) {
    const before = Date.now();
    assert.equal(
      await runOneBackgroundJob(db, {
        signal,
        execute: async () => {
          throw new Error("private provider data");
        },
      }),
      true,
    );
    const [row] = await rows();
    assert.equal(row.status, "pending");
    assert.equal(row.last_error, "Job execution failed");
    assert.ok(row.available_at.getTime() >= before + delay - 100);
    assert.equal(
      await claimJobData(db, 60000, backgroundJobPolicies),
      undefined,
    );
    await due();
  }

  const final = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(final);
  assert.equal(final.attempts, 4);
  await sql`update background_jobs set lease_expires_at = clock_timestamp() - interval '1 second'`.execute(
    db,
  );
  assert.equal(
    await finishJobData(db, final, "success", backgroundJobPolicies),
    false,
  );
  assert.equal(await claimJobData(db, 60000, backgroundJobPolicies), undefined);
  const [row] = await rows();
  assert.equal(row.status, "failed");
  assert.equal(row.last_error, "Job lease expired");
  await clear();
});

test("invalid payload is permanent, unknown jobs stay untouched, and timeouts abort", async () => {
  await sql`insert into background_jobs (type, payload, dedupe_key) values ('embed_package', '{"packageId":"bad"}'::jsonb, 'invalid'), ('future_type', '{}'::jsonb, 'unknown')`.execute(
    db,
  );
  assert.equal(
    await runOneBackgroundJob(db, {
      signal,
      execute: async () => assert.fail("invalid payload ran"),
    }),
    true,
  );
  const found = await rows();
  assert.equal(
    found.find((r) => r.last_error)?.last_error,
    "Invalid job payload",
  );
  assert.equal(found.find((r) => r.status === "pending")?.status, "pending");
  await enqueue(pkg());
  let aborted = false;
  await runOneBackgroundJob(db, {
    signal,
    timeoutMs: 10,
    execute: async (_type, _payload, _db, jobSignal) => {
      await new Promise<void>((resolve) =>
        jobSignal.addEventListener(
          "abort",
          () => {
            aborted = true;
            resolve();
          },
          { once: true },
        ),
      );
    },
  });
  assert.equal(aborted, true);
  assert.equal(
    (await rows()).filter((r) => r.last_error === "Job execution failed")
      .length,
    1,
  );
  await clear();
});

test("worker polls while occupied and shuts down active handlers", async () => {
  const controller = new AbortController();
  let runs = 0;

  const running = runBackgroundJobsWorker(db, {
    signal: controller.signal,
    concurrency: 2,
    pollIntervalMs: 10,
    leaseMs: 1000,
    heartbeatMs: 50,
    execute: async (_type, _payload, _db, jobSignal) => {
      runs++;
      await new Promise<void>((resolve) =>
        jobSignal.addEventListener("abort", () => resolve(), { once: true }),
      );
    },
  });

  await enqueue(pkg());
  await new Promise((resolve) => setTimeout(resolve, 100));
  await enqueue(pkg());
  await new Promise((resolve) => setTimeout(resolve, 100));
  controller.abort();
  await running;
  assert.equal(runs, 2);
  assert.equal((await rows()).filter((r) => r.status === "pending").length, 2);
  await clear();
});

test("expired work yields to a pending successor and a new save resets pending retries", async () => {
  const payload = pkg();
  await enqueue(payload);
  const old = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(old);
  const nextId = await enqueue(payload);
  await sql`update background_jobs set lease_expires_at = clock_timestamp() - interval '1 second' where id = ${old.id}::uuid`.execute(
    db,
  );
  const next = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(next);
  assert.equal(next.id, nextId);

  const previous = (await rows()).find((r) => r.id === old.id);

  assert.equal(previous?.status, "failed");
  assert.equal(previous?.last_error, "Superseded by a newer job");
  assert.equal(await heartbeatJobData(db, old, 60000), false);
  assert.equal(
    await finishJobData(db, old, "success", backgroundJobPolicies),
    false,
  );
  await finishJobData(db, next, "retry", backgroundJobPolicies);
  assert.equal((await rows()).find((r) => r.id === next.id)?.attempts, 1);
  assert.equal(await enqueue(payload), next.id);

  const pending = (await rows()).find((r) => r.id === next.id);

  assert.equal(pending?.attempts, 0);
  assert.equal(pending?.last_error, null);
  assert.ok(pending && pending.available_at.getTime() <= Date.now());
  await clear();
});

test("independent owners can run concurrently and four failures exhaust retries", async () => {
  await enqueue(pkg());
  await enqueue(pkg());
  const [first, second] = await Promise.all([
    claimJobData(db, 60000, backgroundJobPolicies),
    claimJobData(db, 60000, backgroundJobPolicies),
  ]);
  assert.ok(first && second);
  assert.notEqual(first.id, second.id);
  await finishJobData(db, first, "success", backgroundJobPolicies);
  await finishJobData(db, second, "retry", backgroundJobPolicies);

  for (let attempt = 2; attempt <= 4; attempt++) {
    await due();
    assert.equal(
      await runOneBackgroundJob(db, {
        signal,
        execute: async () => {
          throw new Error("private");
        },
      }),
      true,
    );
  }

  const failed = (await rows()).find((row) => row.id === second.id);

  assert.equal(failed?.status, "failed");
  assert.equal(failed?.attempts, 4);
  await clear();
});

test("a shortened retry policy exhausts due pending work without another claim", async () => {
  await enqueue(pkg());
  const first = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(first);
  await finishJobData(db, first, "retry", backgroundJobPolicies);
  await due();
  const second = await claimJobData(db, 60000, backgroundJobPolicies);
  assert.ok(second);
  await finishJobData(db, second, "retry", backgroundJobPolicies);
  await due();
  assert.equal(
    await claimJobData(db, 60000, { embed_package: [10000] }),
    undefined,
  );
  const [job] = await rows();
  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 2);
  assert.equal(job.last_error, "Job attempts exhausted");
  await clear();
});

test("timeout and shutdown stop waiting for an uncooperative handler", async () => {
  const never = () => new Promise<void>(() => {});

  const bounded = async <T>(promise: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("worker did not stop")),
            2000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  await enqueue(pkg());
  await bounded(
    runOneBackgroundJob(db, { signal, timeoutMs: 10, execute: never }),
  );
  assert.equal((await rows())[0]?.status, "pending");
  await clear();
  await enqueue(pkg());
  const controller = new AbortController();

  let started = () => {};

  const began = new Promise<void>((resolve) => {
    started = resolve;
  });

  const worker = runBackgroundJobsWorker(db, {
    signal: controller.signal,
    pollIntervalMs: 10,
    execute: () => {
      started();

      return never();
    },
  });

  await bounded(began);
  controller.abort();
  await bounded(worker);
  assert.equal((await rows())[0]?.status, "pending");
  await clear();
});
