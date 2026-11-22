import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  supportingDocumentSchema,
  supportingDocumentsResponseSchema,
} from "@event-management/contracts/supporting-documents";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import {
  SMALL_JSON_BODY_LIMIT_BYTES,
  SUPPORTING_DOCUMENT_UPLOAD_BODY_LIMIT_BYTES,
} from "../src/constants/http.js";
import routes from "../src/controllers/ai/index.js";
import type { DB } from "../src/db/types.js";
import { runOneBackgroundJob } from "../src/services/background-jobs/run-one-background-job.js";
import type { HonoEnv } from "../src/types/hono.js";
import { hashSessionToken } from "../src/utils/session.js";
import { buildPdf, textPage } from "./fixtures/supporting-pdf.js";

const database = `supporting_docs_${randomUUID().replaceAll("-", "")}`;

const originalFetch = globalThis.fetch;

const objects = new Map<string, Uint8Array<ArrayBuffer>>();

let adminPool: pg.Pool | undefined;
let db: Kysely<DB>;
let app: OpenAPIHono<HonoEnv>;
let adminCookie: string;
let customerCookie: string;
let providerCalls = 0;
let failEmbedding = false;

function handbookPdf() {
  return buildPdf({
    pages: ["Venue preparation", "Event setup"].map((heading) =>
      textPage([
        { text: heading, size: 18, x: 48, y: 750 },
        ...Array.from({ length: 72 }, (_, row) => ({
          text: `${heading} step ${row + 1}: Ask the venue about entrance access, clearance, and power.`,
          size: 8,
          x: 48,
          y: 733 - row * 9,
        })),
      ]),
    ),
  });
}

async function session(role: string) {
  const token = randomUUID();
  const user = await db
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      role,
      password_hash: "unused",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("sessions")
    .values({
      user_id: user.id,
      token_hash: hashSessionToken(token),
      expires_at: new Date(Date.now() + 60_000),
    })
    .execute();

  return `em_session=${token}`;
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
  adminPool = new pg.Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  const pool = new pg.Pool({ ...connection, database });
  db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  const migrationRoot = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(
        new URL(`${entry.name}/migration.sql`, migrationRoot),
        "utf8",
      ),
    );

  process.env.SUPABASE_URL = "http://storage.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-storage";
  process.env.AI_GATEWAY_API_KEY = "fixture-embedding";
  process.env.EMBEDDING_MODEL = "google/gemini-embedding-2";
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (url.hostname === "storage.test") {
      assert.match(
        url.pathname,
        /^\/storage\/v1\/object\/supporting-documents\//,
      );

      if (init?.method === "POST") {
        objects.set(url.pathname, Uint8Array.from(init.body as Uint8Array));

        return new Response(null, { status: 201 });
      }

      return new Response(objects.get(url.pathname) ?? null);
    }

    assert.equal(url.hostname, "ai-gateway.vercel.sh");
    const { values, dimensions } = JSON.parse(String(init?.body));
    assert.equal(values.length, 1);
    assert.equal(dimensions, 768);
    providerCalls++;

    return failEmbedding
      ? new Response("unavailable", { status: 503 })
      : Response.json({
          embeddings: [[1, ...Array<number>(767).fill(0)]],
          warnings: [],
        });
  };

  adminCookie = await session("admin");
  customerCookie = await session("customer");
  app = new OpenAPIHono<HonoEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/v1", routes);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await db?.destroy();

  if (adminPool) {
    await adminPool.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await adminPool.end();
  }
});

const path = "/v1/admin/ai/documents";

const work = () =>
  runOneBackgroundJob(db, { signal: AbortSignal.timeout(30_000) });

const list = async () =>
  supportingDocumentsResponseSchema.parse(
    await (
      await app.request(path, { headers: { cookie: adminCookie } })
    ).json(),
  ).documents[0]!;

test("document upload and retry keep their admin guards and separate body limits", async () => {
  const retryPath = `${path}/${randomUUID()}/retry`;

  for (const endpoint of [path, retryPath]) {
    assert.equal((await app.request(endpoint, { method: "POST" })).status, 401);
    assert.equal(
      (
        await app.request(endpoint, {
          method: "POST",
          headers: { cookie: customerCookie },
        })
      ).status,
      403,
    );
  }

  const largeBody = "x".repeat(SMALL_JSON_BODY_LIMIT_BYTES + 1);

  // The upload reaches multipart validation, while retry rejects the same size.
  assert.equal(
    (
      await app.request(path, {
        method: "POST",
        headers: { cookie: adminCookie },
        body: largeBody,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await app.request(retryPath, {
        method: "POST",
        headers: { cookie: adminCookie },
        body: largeBody,
      })
    ).status,
    413,
  );

  const oversizedUpload = await app.request(path, {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "content-length": String(SUPPORTING_DOCUMENT_UPLOAD_BODY_LIMIT_BYTES + 1),
    },
    body: "oversized upload",
  });
  assert.equal(oversizedUpload.status, 413);
  assert.deepEqual(await oversizedUpload.json(), {
    error: "Choose a PDF up to 25 MB.",
  });
});

test("admin upload persists a private PDF and independently retries one NULL chunk at a time", async () => {
  assert.equal((await app.request(path)).status, 401);
  assert.equal(
    (await app.request(path, { headers: { cookie: customerCookie } })).status,
    403,
  );
  const form = new FormData();
  const pdf = Uint8Array.from(handbookPdf());
  assert.ok(pdf.byteLength > SMALL_JSON_BODY_LIMIT_BYTES);
  form.set(
    "file",
    new File([pdf], "Venue handbook.pdf", {
      type: "application/pdf",
    }),
  );
  const response = await app.request(path, {
    method: "POST",
    headers: { cookie: adminCookie },
    body: form,
  });
  assert.equal(response.status, 202);
  const document = supportingDocumentSchema.parse(await response.json());
  assert.equal(document.originalFilename, "Venue handbook.pdf");
  assert.equal(document.state, "extracting");
  assert.equal(objects.size, 1);
  assert.equal(providerCalls, 0);

  assert.equal(await work(), true);
  const chunks = await db
    .selectFrom("supporting_document_chunks")
    .selectAll()
    .orderBy("ordinal")
    .execute();
  assert.ok(chunks.length >= 2);
  assert.ok(
    chunks.every(
      (chunk, index) =>
        chunk.ordinal === index + 1 &&
        chunk.embedding === null &&
        chunk.embedding_model === null &&
        chunk.embedded_at === null,
    ),
  );
  const jobs = await db
    .selectFrom("background_jobs")
    .selectAll()
    .where("type", "=", "embed_document_chunk")
    .execute();
  assert.equal(jobs.length, chunks.length);
  assert.deepEqual(
    jobs.map((job) => job.dedupe_key).sort(),
    chunks.map((chunk) => chunk.id).sort(),
  );

  for (const job of jobs)
    assert.deepEqual(job.payload, { chunkId: job.dedupe_key });

  assert.equal((await list()).pageCount, 2);
  assert.equal(providerCalls, 0);

  failEmbedding = true;
  assert.equal(await work(), true);
  failEmbedding = false;

  while (await work()) {
    /* Process each other queued chunk. */
  }

  assert.equal((await list()).embeddedCount, chunks.length - 1);
  const retrying = await db
    .selectFrom("background_jobs")
    .selectAll()
    .where("type", "=", "embed_document_chunk")
    .where("status", "=", "pending")
    .executeTakeFirstOrThrow();
  assert.equal(retrying.attempts, 1);
  failEmbedding = true;

  for (let attempt = 2; attempt <= 4; attempt++) {
    await db
      .updateTable("background_jobs")
      .set("available_at", sql<Date>`clock_timestamp()`)
      .where("id", "=", retrying.id)
      .execute();
    assert.equal(await work(), true);
  }

  assert.equal((await list()).state, "failed");
  assert.equal((await list()).failedCount, 1);
  assert.equal((await list()).canRetry, true);

  const retry = await app.request(`${path}/${document.id}/retry`, {
    method: "POST",
    headers: { cookie: adminCookie },
  });
  assert.equal(retry.status, 202);
  assert.equal(
    supportingDocumentSchema.parse(await retry.json()).state,
    "embedding",
  );
  failEmbedding = false;
  assert.equal(await work(), true);
  assert.equal(await work(), false);
  const ready = await list();
  assert.equal(ready.state, "ready");
  assert.equal(ready.embeddedCount, chunks.length);
  assert.equal(providerCalls, chunks.length + 4);
});
