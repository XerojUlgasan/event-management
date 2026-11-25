import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  supportingDocumentSchema,
  supportingDocumentSearchResponseSchema,
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
import { r2Fixture } from "./helpers/r2-fixture.js";
import { setTestConfig } from "./helpers/set-test-config.js";

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
let failStorageDelete = false;
let providerInput: string;
let pauseEmbedding: (() => Promise<void>) | undefined;

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

  setTestConfig(r2Fixture);
  setTestConfig({ AI_GATEWAY_API_KEY: "fixture-embedding" });
  setTestConfig({ EMBEDDING_MODEL: "google/gemini-embedding-2" });
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (url.origin === r2Fixture.S3_API_URL) {
      assert.ok(input instanceof Request);
      assert.match(url.pathname, /^\/test\/[\da-f-]+\.pdf$/);

      if (input.method === "DELETE") {
        if (failStorageDelete) return new Response(null, { status: 502 });

        objects.delete(url.pathname);

        return new Response(null, { status: 204 });
      }

      if (input.method === "PUT") {
        objects.set(url.pathname, new Uint8Array(await input.arrayBuffer()));

        return new Response(null, { status: 200 });
      }

      const object = objects.get(url.pathname);
      return object
        ? new Response(object)
        : new Response(null, { status: 404 });
    }

    assert.equal(url.hostname, "ai-gateway.vercel.sh");
    const { values, dimensions } = JSON.parse(String(init?.body));
    assert.equal(values.length, 1);
    assert.equal(dimensions, 768);
    providerCalls++;
    providerInput = values[0];
    await pauseEmbedding?.();

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

const search = (query: string, cookie?: string) =>
  app.request(`${path}/search`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify({ query }),
  });

const work = () =>
  runOneBackgroundJob(db, { signal: AbortSignal.timeout(30_000) });

const documents = async () =>
  supportingDocumentsResponseSchema.parse(
    await (
      await app.request(path, { headers: { cookie: adminCookie } })
    ).json(),
  ).documents;

const list = async () => (await documents())[0]!;

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

test("admin can upload, retry, inspect and delete a private PDF and its chunks", async () => {
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

  const query = "  How do I prepare the venue?  ";
  assert.equal((await search(query)).status, 401);
  assert.equal((await search(query, customerCookie)).status, 403);
  assert.equal((await search("   ", adminCookie)).status, 400);
  assert.equal(
    (await search("x".repeat(SMALL_JSON_BODY_LIMIT_BYTES), adminCookie)).status,
    413,
  );
  assert.equal(providerCalls, chunks.length + 4);

  const responseToSearch = await search(query, adminCookie);
  assert.equal(responseToSearch.status, 200);
  assert.equal(
    providerInput,
    "task: search result | query: How do I prepare the venue?",
  );
  const { results } = supportingDocumentSearchResponseSchema.parse(
    await responseToSearch.json(),
  );
  assert.equal(results.length, Math.min(5, chunks.length));
  const first = results[0]!;

  const firstChunk = chunks.find((chunk) => chunk.id === first.id)!;

  const firstJob = jobs.find((job) => job.dedupe_key === first.id)!;

  assert.equal(first.filename, document.originalFilename);
  assert.equal(first.createdAt, firstJob.created_at.toISOString());
  assert.equal(first.pageStart, firstChunk.page_start);
  assert.equal(first.pageEnd, firstChunk.page_end);
  assert.deepEqual(first.headingPath, firstChunk.heading_path);
  assert.equal(first.text, firstChunk.content_text);

  failEmbedding = true;
  assert.equal((await search(query, adminCookie)).status, 503);
  failEmbedding = false;

  const remove = (cookie?: string) =>
    app.request(`${path}/${document.id}`, {
      method: "DELETE",
      headers: cookie ? { cookie } : {},
    });

  assert.equal((await remove()).status, 401);
  assert.equal((await remove(customerCookie)).status, 403);
  failStorageDelete = true;
  assert.equal((await remove(adminCookie)).status, 502);
  failStorageDelete = false;
  assert.equal((await list()).embeddedCount, chunks.length);
  assert.equal(objects.size, 1);

  assert.equal((await remove(adminCookie)).status, 204);
  assert.equal((await remove(adminCookie)).status, 204);
  assert.equal(objects.size, 0);
  assert.deepEqual(await documents(), []);
  assert.deepEqual(
    await db.selectFrom("supporting_document_chunks").select("id").execute(),
    [],
  );
  assert.deepEqual(
    supportingDocumentSearchResponseSchema.parse(
      await (await search(query, adminCookie)).json(),
    ).results,
    [],
  );
});

test("deleting a PDF during embedding prevents the worker from recreating chunks", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File([Uint8Array.from(handbookPdf())], "Remove while embedding.pdf"),
  );
  const upload = await app.request(path, {
    method: "POST",
    headers: { cookie: adminCookie },
    body: form,
  });
  assert.equal(upload.status, 202);

  const { id } = supportingDocumentSchema.parse(await upload.json());
  assert.equal(await work(), true);

  let markPickedUp!: () => void;
  let allowFinish!: () => void;

  const pickedUp = new Promise<void>((resolve) => {
    markPickedUp = resolve;
  });

  const finish = new Promise<void>((resolve) => {
    allowFinish = resolve;
  });

  pauseEmbedding = () => {
    markPickedUp();

    return finish;
  };

  const working = work();

  try {
    await Promise.race([
      pickedUp,
      working.then(() => {
        throw new Error("The worker did not start embedding");
      }),
    ]);
    const deletion = await app.request(`${path}/${id}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    assert.equal(deletion.status, 204);
  } finally {
    pauseEmbedding = undefined;
    allowFinish();
    await working;
  }

  const calls = providerCalls;

  while (await work()) {
    // Queued jobs for the deleted chunks should finish without another call.
  }

  assert.equal(providerCalls, calls);
  assert.deepEqual(await documents(), []);
  assert.deepEqual(
    await db.selectFrom("supporting_document_chunks").select("id").execute(),
    [],
  );
});

test("document search ranks and limits individual passages from the active model", async () => {
  const document = await db
    .insertInto("supporting_documents")
    .values({
      original_filename: "Ranked passages.pdf",
      storage_key: `${randomUUID()}.pdf`,
      mime_type: "application/pdf",
      byte_size: 500,
      file_sha256: "a".repeat(64),
      pipeline_version: "fixture",
      extraction_status: "complete",
      page_count: 1,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const suffix = Array<number>(766).fill(0);
  const candidates = [
    { ordinal: 1, leading: 0.1 },
    { ordinal: 2, leading: 0.7 },
    { ordinal: 3, leading: 0.3 },
    { ordinal: 4, leading: 0.8 },
    { ordinal: 5, leading: 0.4 },
    { ordinal: 6, leading: 0.6 },
    { ordinal: 7, leading: 1, model: "old-model" },
    { ordinal: 8, leading: null },
  ];
  await db
    .insertInto("supporting_document_chunks")
    .values(
      candidates.map(({ ordinal, leading, model }) => ({
        document_id: document.id,
        ordinal,
        page_start: 1,
        page_end: 1,
        content_text: `Passage ${ordinal}`,
        content_hash: "b".repeat(64),
        embedding:
          leading === null
            ? null
            : sql<string>`${JSON.stringify([leading, Math.sqrt(1 - leading ** 2), ...suffix])}`,
        embedding_model:
          leading === null ? null : (model ?? "google/gemini-embedding-2"),
        embedded_at: leading === null ? null : new Date(),
      })),
    )
    .execute();

  const response = await search("entrance access", adminCookie);
  assert.equal(response.status, 200);
  const { results } = supportingDocumentSearchResponseSchema.parse(
    await response.json(),
  );
  assert.deepEqual(
    results.map(({ text }) => text),
    [4, 2, 6, 5, 3].map((ordinal) => `Passage ${ordinal}`),
  );
  assert.ok(results.every(({ createdAt }) => createdAt === null));
});
