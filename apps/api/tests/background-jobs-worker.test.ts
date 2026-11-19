import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { Pool } from "pg";

test("standalone worker repeatedly consumes its database and exits on SIGTERM", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_worker_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  let worker: ReturnType<typeof spawn> | undefined;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    const databasePool = new Pool({ ...connection, database });
    pool = databasePool;
    const migrations = new URL("../prisma/migrations/", import.meta.url);

    for (const entry of (await readdir(migrations, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await pool.query(
        await readFile(
          new URL(`${entry.name}/migration.sql`, migrations),
          "utf8",
        ),
      );
    }

    const insert = async () =>
      (
        await databasePool.query<{ id: string }>(
          "INSERT INTO background_jobs(type,payload) VALUES('embed_package','{}') RETURNING id",
        )
      ).rows[0].id;

    const first = await insert();
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/workers/background-jobs.ts"],
      {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          DB_NAME: database,
          AI_GATEWAY_API_KEY: "",
          EMBEDDING_MODEL: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    worker = child;
    assert.ok(child.stdout);
    assert.ok(child.stderr);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", () => {});
    async function waitForFailure(id: string) {
      const deadline = Date.now() + 15_000;

      while (Date.now() < deadline) {
        const row = (
          await databasePool.query<{
            status: string;
            attempts: number;
            last_error: string;
          }>(
            "SELECT status,attempts,last_error FROM background_jobs WHERE id=$1",
            [id],
          )
        ).rows[0];

        if (row.status === "failed") {
          assert.equal(row.attempts, 1);
          assert.equal(row.last_error, "Invalid job payload");

          return;
        }

        assert.equal(child.exitCode, null, "worker must remain running");
        await sleep(50);
      }

      assert.fail("Worker did not consume the queued job");
    }
    await waitForFailure(first);
    await waitForFailure(await insert());
    assert.match(output, /polling every 3000 ms/);
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const [code] = await exited;
    assert.equal(code, 0);
  } finally {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      const exited = once(worker, "exit");
      worker.kill("SIGKILL");
      await exited;
    }

    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
