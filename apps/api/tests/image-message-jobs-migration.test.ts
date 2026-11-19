import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";

const migration = "20261119112935_image_message_jobs_only";

const database = `em_image_job_migration_${randomUUID().replaceAll("-", "")}`;

let admin: Pool, pool: Pool;
let migrationSql: string;

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
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name >= migration) break;

    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }

  migrationSql = await readFile(
    new URL(`${migration}/migration.sql`, root),
    "utf8",
  );
});

after(async () => {
  await pool?.end();

  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});

test("migrates saved image jobs, fences retired text jobs and preserves messages and guest replays", async () => {
  const identity = randomUUID(),
    conversation = randomUUID();
  await pool.query(
    "INSERT INTO guest_chat_identities(id, token_hash) VALUES ($1, $2)",
    [identity, randomUUID()],
  );
  await pool.query(
    "INSERT INTO conversations(id, guest_identity_id, guest_expires_at) VALUES ($1, $2, now() + interval '1 day')",
    [conversation, identity],
  );
  const fixtures: {
    id: string;
    image: boolean;
    status: string;
    reply: string | null;
  }[] = [];

  for (const image of [false, true]) {
    for (const status of ["pending", "running", "completed", "failed"]) {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO messages(id, conversation_id, sender_role, guest_origin, body) VALUES ($1, $2, 'customer', true, 'migration fixture')",
        [id, conversation],
      );

      if (image) {
        await pool.query(
          "INSERT INTO message_images(message_id, position, storage_key, mime_type, byte_size, content_hash) VALUES ($1, 0, $2, 'image/png', 1, $3)",
          [id, `fixture/${id}.png`, "a".repeat(64)],
        );
      }

      const reply = !image && status === "running" ? randomUUID() : null;

      if (reply) {
        await pool.query(
          "INSERT INTO messages(id, conversation_id, sender_role, body, reply_to_message_id) VALUES ($1, $2, 'assistant', 'Already saved reply', $3)",
          [reply, conversation, id],
        );
      }

      await pool.query(
        "INSERT INTO guest_message_requests(conversation_id, request_id, message_id) VALUES ($1, $2, $2)",
        [conversation, id],
      );
      await pool.query(
        `INSERT INTO background_jobs(type, payload, dedupe_key, status, attempts, lease_token, lease_expires_at, completed_at)
         VALUES ('process_message', $1, $2, $3, 1,
           CASE WHEN $3 = 'running' THEN gen_random_uuid() ELSE NULL END,
           CASE WHEN $3 = 'running' THEN now() + interval '1 minute' ELSE NULL END,
           CASE WHEN $3 IN ('completed', 'failed') THEN clock_timestamp() ELSE NULL END)`,
        [
          JSON.stringify({
            messageId: id,
            conversationId: conversation,
            aiVersion: 0,
          }),
          id,
          status,
        ],
      );
      fixtures.push({ id, image, status, reply });
    }
  }

  await pool.query(
    "INSERT INTO background_jobs(type, payload) VALUES ('embed_package', '{}')",
  );
  const savedMessages = (await pool.query("SELECT * FROM messages ORDER BY id"))
    .rows;
  const savedImages = (
    await pool.query("SELECT * FROM message_images ORDER BY id")
  ).rows;
  await pool.query(migrationSql);

  for (const fixture of fixtures) {
    const job = (
      await pool.query("SELECT * FROM background_jobs WHERE dedupe_key = $1", [
        fixture.id,
      ])
    ).rows[0];
    assert.equal(
      job.type,
      fixture.image ? "process_image_message" : "process_message",
    );
    assert.deepEqual(job.payload, {
      messageId: fixture.id,
      conversationId: conversation,
      aiVersion: 0,
    });
    const retired =
      !fixture.image && ["pending", "running"].includes(fixture.status);
    assert.equal(job.status, retired ? "failed" : fixture.status);

    if (retired) {
      assert.equal(job.lease_token, null);
      assert.equal(job.lease_expires_at, null);
      assert.ok(job.completed_at);
      const request = (
        await pool.query(
          "SELECT * FROM guest_message_requests WHERE message_id = $1",
          [fixture.id],
        )
      ).rows[0];
      assert.equal(request.completed, true);
      assert.equal(request.assistant_message_id, fixture.reply);
      assert.equal(
        request.assistant_error,
        fixture.reply
          ? null
          : "Your message was saved, but the AI reply is unavailable. You do not need to resend your message.",
      );
    }
  }

  assert.deepEqual(
    (await pool.query("SELECT * FROM messages ORDER BY id")).rows,
    savedMessages,
  );
  assert.deepEqual(
    (await pool.query("SELECT * FROM message_images ORDER BY id")).rows,
    savedImages,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT status FROM background_jobs WHERE type = 'embed_package'",
      )
    ).rows[0].status,
    "pending",
  );
  const migratedJobs = (
    await pool.query("SELECT * FROM background_jobs ORDER BY id")
  ).rows;
  await pool.query(migrationSql);
  assert.deepEqual(
    (await pool.query("SELECT * FROM background_jobs ORDER BY id")).rows,
    migratedJobs,
  );
});
