import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import type { HonoEnv } from "../../src/types/hono.js";
import routes from "../../src/controllers/ai/index.js";
import { hashSessionToken } from "../../src/utils/session.js";
import {
  catalogKnowledgeDigest,
  syncCatalogKnowledge,
} from "../../src/services/ai/retrieval/sync-catalog-knowledge.js";
import { saveCatalogKnowledgeEmbeddingData } from "../../src/data/ai/catalog-knowledge.js";

const database = `em_knowledge_search_${randomUUID().replaceAll("-", "")}`;
const originalFetch = globalThis.fetch;
const originalKey = process.env.AI_GATEWAY_API_KEY;
const originalModel = process.env.EMBEDDING_MODEL;
const model = "google/gemini-embedding-2";
let admin: Pool | undefined;
let db: Kysely<DB> | undefined;
let app: OpenAPIHono<HonoEnv>;
let adminCookie: string;
let customerCookie: string;
let calls = 0;
let providerFail = false;
const vector = (x: number, y: number) => [x, y, ...Array(766).fill(0)];
before(async () => {
  process.env.AI_GATEWAY_API_KEY = "fixture-key";
  process.env.EMBEDDING_MODEL = model;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.deepEqual(JSON.parse(String(init?.body)).values, [
      "task: search result | query: garden",
    ]);
    assert.ok(init?.signal);
    return providerFail
      ? new Response("failure", { status: 503 })
      : new Response(
          JSON.stringify({ embeddings: [vector(1, 0)], warnings: [] }),
          { headers: { "Content-Type": "application/json" } },
        );
  };
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
  const root = new URL("../../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  async function session(role: string) {
    const token = randomUUID();
    const user = await db!
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        password_hash: "unused",
        role,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db!
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3600000),
      })
      .execute();
    return `em_session=${token}`;
  }
  adminCookie = await session("admin");
  customerCookie = await session("customer");
  app = new OpenAPIHono<HonoEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db!);
    await next();
  });
  app.route("/v1", routes);
});
after(async () => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.EMBEDDING_MODEL;
  else process.env.EMBEDDING_MODEL = originalModel;
  await db?.destroy();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
const request = (body: unknown, cookie?: string) =>
  app.request("/v1/admin/ai/knowledge/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

test("rejects unauthorized and invalid requests before embedding", async () => {
  assert.equal((await request({ query: "garden" })).status, 401);
  assert.equal(
    (await request({ query: "garden" }, customerCookie)).status,
    403,
  );
  assert.equal((await request({ query: " " }, adminCookie)).status, 400);
  assert.equal(
    (await request({ query: "x".repeat(501) }, adminCookie)).status,
    400,
  );
  assert.equal(calls, 0);
});

test("returns ranked current text and photos while excluding stale, pending, incompatible, withdrawn and archived entries", async () => {
  const photoId = randomUUID(),
    photoWidget = randomUUID(),
    textWidget = randomUUID();
  await db!
    .insertInto("media_assets")
    .values({
      id: photoId,
      kind: "image",
      source: "upload",
      url: null,
      storage_key: `catalog-media/${photoId}`,
      mime_type: "image/png",
      byte_size: 1,
      created_by: null,
    })
    .execute();
  const canvas = [
    {
      id: randomUUID(),
      title: "Garden",
      widgets: [
        {
          id: photoWidget,
          type: "photo",
          x: 0,
          y: 0,
          w: 6,
          h: 5,
          markdown: "",
          mediaId: photoId,
          alt: "flowers",
          caption: "",
          autoplay: false,
        },
        {
          id: textWidget,
          type: "markdown",
          x: 0,
          y: 5,
          w: 12,
          h: 4,
          markdown: "Garden text",
          mediaId: null,
          alt: "",
          caption: "",
          autoplay: false,
        },
      ],
    },
  ];
  const service = await db!
    .insertInto("services")
    .values({
      name: "Garden",
      slug: "garden",
      description: "",
      hourly_rate_pesos: 1,
      canvas: sql`${JSON.stringify(canvas)}::jsonb`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const rows = await db!
    .transaction()
    .execute((trx) =>
      syncCatalogKnowledge(trx, { kind: "service", id: service.id }),
    );
  for (const row of rows) {
    const digest = row.media_id
      ? "a".repeat(64)
      : catalogKnowledgeDigest(row.content_markdown);
    const fullHash = `${row.content_hash}:${digest}`;
    await db!
      .updateTable("catalog_knowledge")
      .set({ content_hash: fullHash })
      .where("id", "=", row.id)
      .execute();
    await saveCatalogKnowledgeEmbeddingData(db!, row.id, fullHash, {
      model,
      embedding: row.chunk_key.startsWith("photo:")
        ? vector(1, 0)
        : vector(0.6, 0.8),
    });
  }
  const original = rows.find((r) => r.chunk_key === "overview")!;
  await db!
    .updateTable("catalog_knowledge")
    .set({ content_hash: "stale" })
    .where("id", "=", original.id)
    .execute();
  const withdrawn = await db!
    .insertInto("catalog_knowledge")
    .values({
      service_id: service.id,
      package_id: null,
      chunk_key: "withdrawn",
      content_markdown: "old",
      content_hash: "old",
      media_id: null,
      embedding: null,
      embedding_model: null,
      embedded_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await saveCatalogKnowledgeEmbeddingData(db!, withdrawn.id, "old", {
    model,
    embedding: vector(1, 0),
  });
  const source = await db!
    .insertInto("packages")
    .values({
      name: "Source",
      slug: "source",
      description: "",
      max_guests: 40,
      price: 100,
      package_type: "catalog",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db!
    .transaction()
    .execute((trx) =>
      syncCatalogKnowledge(trx, { kind: "package", id: source.id }),
    );
  const customer = await db!
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      password_hash: "unused",
      role: "customer",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const booking = await db!
    .insertInto("booking_requests")
    .values({
      reference: `fixture-${randomUUID()}`,
      customer_id: customer.id,
      package_id: source.id,
      event_type: "Wedding",
      preferred_date: "2027-06-01",
      time_zone: "Asia/Manila",
      guest_count: 40,
      contact_name: "Fixture",
      phone_number: "+639000000000",
      preferred_venue_location: null,
      special_requests: null,
      out_of_range: false,
      requested_days: null,
      estimated_duration_days: null,
      starts_at: null,
      ends_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const custom = await db!
    .insertInto("packages")
    .values({
      name: "Private",
      slug: "private",
      description: "",
      max_guests: 40,
      price: 100,
      package_type: "custom",
      custom_for_booking_request_id: booking.id,
      published_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const privateChunk = await db!
    .insertInto("catalog_knowledge")
    .values({
      package_id: custom.id,
      service_id: null,
      chunk_key: "overview",
      content_markdown: "private",
      content_hash: "private",
      media_id: null,
      embedding: null,
      embedding_model: null,
      embedded_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await saveCatalogKnowledgeEmbeddingData(db!, privateChunk.id, "private", {
    model,
    embedding: vector(1, 0),
  });
  const archived = await db!
    .insertInto("services")
    .values({
      name: "Archived",
      slug: "archived",
      description: "",
      hourly_rate_pesos: 1,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const archivedRows = await db!
    .transaction()
    .execute((trx) =>
      syncCatalogKnowledge(trx, { kind: "service", id: archived.id }),
    );
  const a = archivedRows[0]!;
  const ah = `${a.content_hash}:${catalogKnowledgeDigest(a.content_markdown)}`;
  await db!
    .updateTable("catalog_knowledge")
    .set({ content_hash: ah })
    .where("id", "=", a.id)
    .execute();
  await saveCatalogKnowledgeEmbeddingData(db!, a.id, ah, {
    model,
    embedding: vector(1, 0),
  });
  await db!
    .updateTable("services")
    .set({ archived_at: new Date() })
    .where("id", "=", archived.id)
    .execute();
  const response = await request({ query: " garden " }, adminCookie);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.query, "garden");
  assert.equal(result.model, model);
  assert.deepEqual(
    result.results.map((r: { kind: string }) => r.kind),
    ["photo", "text"],
  );
  assert.equal(result.results[0].mediaUrl, `/v1/catalog-media/${photoId}`);
  assert.ok(result.results[0].similarity > result.results[1].similarity);
  await db!
    .updateTable("catalog_knowledge")
    .set({ embedding_model: "other" })
    .where("chunk_key", "=", `photo:${photoWidget}`)
    .execute();
  const second = await (await request({ query: "garden" }, adminCookie)).json();
  assert.deepEqual(
    second.results.map((r: { kind: string }) => r.kind),
    ["text"],
  );
});

test("maps provider failures to a sanitized 503", async () => {
  providerFail = true;
  const response = await request({ query: "garden" }, adminCookie);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Knowledge search is temporarily unavailable",
  });
  providerFail = false;
  delete process.env.AI_GATEWAY_API_KEY;
  const previousCalls = calls;
  const unconfigured = await request({ query: "garden" }, adminCookie);
  assert.equal(unconfigured.status, 503);
  assert.equal(calls, previousCalls);
  process.env.AI_GATEWAY_API_KEY = "fixture-key";
});

test("caps results after removing stale high-scoring candidates", async () => {
  providerFail = false;
  for (let i = 0; i < 23; i++) {
    const service = await db!
      .insertInto("services")
      .values({
        name: `Rank ${i}`,
        slug: `rank-${i}`,
        description: "",
        hourly_rate_pesos: 1,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const [row] = await db!
      .transaction()
      .execute((trx) =>
        syncCatalogKnowledge(trx, { kind: "service", id: service.id }),
      );
    const hash = `${row!.content_hash}:${catalogKnowledgeDigest(row!.content_markdown)}`;
    await db!
      .updateTable("catalog_knowledge")
      .set({ content_hash: hash })
      .where("id", "=", row!.id)
      .execute();
    await saveCatalogKnowledgeEmbeddingData(db!, row!.id, hash, {
      model,
      embedding: vector(0.1, 0.995),
    });
  }
  const response = await request({ query: "garden" }, adminCookie);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.results.length, 5);
  assert.equal(body.results[0].kind, "text");
  assert.ok(
    body.results.every(
      (item: { listing: { name: string } }) =>
        item.listing.name === "Garden" || item.listing.name.startsWith("Rank "),
    ),
  );
});
