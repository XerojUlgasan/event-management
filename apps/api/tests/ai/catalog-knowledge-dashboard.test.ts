import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import type { HonoEnv } from "../../src/types/hono.js";
import routes from "../../src/controllers/ai/index.js";
import { hashSessionToken } from "../../src/utils/session.js";
import {
  catalogKnowledgeDigest,
  catalogKnowledgeSourceHash,
} from "../../src/services/ai/catalog-knowledge-hash.js";
import { assessKnowledgeListing } from "../../src/services/ai/catalog-knowledge-status.js";

const chunk = {
  chunkKey: "overview",
  contentMarkdown: "fixture",
  mediaId: null,
};

const owner = { id: "owner", name: "Fixture", kind: "service" as const };

const hash = catalogKnowledgeSourceHash(chunk.contentMarkdown, undefined);

const ready = {
  chunk_key: "overview",
  content_markdown: "fixture",
  content_hash: `${hash}:${catalogKnowledgeDigest("fixture")}`,
  media_id: null,
  embedding_model: "google/gemini-embedding-2",
  embedded_at: new Date("2026-01-01T00:00:00Z"),
  has_embedding: true,
};

test("coverage requires expected content, input hash and model and detects withdrawn rows", () => {
  assert.equal(
    assessKnowledgeListing(owner, [chunk], [], new Map()).listing.status,
    "pending",
  );
  assert.equal(
    assessKnowledgeListing(owner, [chunk], [ready], new Map()).listing.status,
    "indexed",
  );
  assert.equal(
    assessKnowledgeListing(
      owner,
      [chunk, { ...chunk, chunkKey: "markdown:1" }],
      [ready],
      new Map(),
    ).listing.status,
    "partial",
  );
  assert.equal(
    assessKnowledgeListing(
      owner,
      [chunk],
      [{ ...ready, embedding_model: "other" }],
      new Map(),
    ).listing.status,
    "needs-refresh",
  );
  assert.equal(
    assessKnowledgeListing(
      owner,
      [chunk],
      [{ ...ready, content_hash: `${hash}:${"0".repeat(64)}` }],
      new Map(),
    ).listing.status,
    "needs-refresh",
  );
  assert.equal(
    assessKnowledgeListing(
      owner,
      [chunk],
      [ready, { ...ready, chunk_key: "withdrawn" }],
      new Map(),
    ).listing.status,
    "needs-refresh",
  );
  const stale = assessKnowledgeListing(
    owner,
    [chunk],
    [{ ...ready, content_markdown: "previous indexed text" }],
    new Map(),
  );
  assert.equal(stale.chunks[0]?.status, "needs-refresh");
  assert.equal(stale.chunks[0]?.contentMarkdown, "previous indexed text");
  assert.equal(stale.chunks[0]?.embeddedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(stale.listing.lastIndexedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(
    assessKnowledgeListing(owner, [chunk], [], new Map()).chunks[0]?.embeddedAt,
    null,
  );
  const removed = assessKnowledgeListing(
    owner,
    [chunk],
    [
      ready,
      {
        ...ready,
        chunk_key: "photo:removed",
        content_markdown: "Old photo context",
        media_id: "removed-media",
      },
    ],
    new Map(),
  );
  assert.equal(removed.listing.status, "needs-refresh");
  assert.equal(removed.listing.expectedChunks, 1);
  assert.equal(removed.listing.indexedChunks, 1);
  assert.equal(removed.listing.textChunks, 1);
  assert.equal(removed.listing.photoChunks, 0);
  assert.deepEqual(removed.chunks[1], {
    key: "photo:removed",
    kind: "photo",
    withdrawn: true,
    status: "needs-refresh",
    contentMarkdown: "Old photo context",
    mediaUrl: null,
    embeddedAt: "2026-01-01T00:00:00.000Z",
  });
});

test("photo coverage checks metadata and stored digest without fetching bytes", () => {
  const asset = {
    id: "photo-id",
    kind: "image",
    source: "sample",
    url: "/images/wedding.jpg",
    storage_key: null,
    mime_type: null,
    byte_size: null,
    created_by: null,
    created_at: new Date(),
  };
  const photo = {
    chunkKey: "photo:1",
    contentMarkdown: "photo context",
    mediaId: asset.id,
  };
  const photoRow = {
    ...ready,
    chunk_key: photo.chunkKey,
    content_markdown: photo.contentMarkdown,
    media_id: asset.id,
    content_hash: `${catalogKnowledgeSourceHash(photo.contentMarkdown, asset)}:${"a".repeat(64)}`,
  };
  const result = assessKnowledgeListing(
    owner,
    [photo],
    [photoRow],
    new Map([[asset.id, asset]]),
  );
  assert.equal(result.listing.status, "indexed");
  assert.equal(result.chunks[0]?.mediaUrl, "/images/wedding.jpg");
  assert.equal(
    assessKnowledgeListing(owner, [photo], [photoRow], new Map()).listing
      .status,
    "needs-refresh",
  );
  assert.equal(
    assessKnowledgeListing(
      owner,
      [photo],
      [{ ...photoRow, content_hash: photoRow.content_hash.slice(0, -1) }],
      new Map([[asset.id, asset]]),
    ).listing.status,
    "needs-refresh",
  );
});

const database = `em_knowledge_dashboard_${randomUUID().replaceAll("-", "")}`;

let admin: Pool | undefined;
let db: Kysely<DB> | undefined;
let app: OpenAPIHono<HonoEnv>;
let adminCookie: string;
let customerCookie: string;

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
  await db
    .insertInto("services")
    .values([
      { name: "Alpha", slug: "alpha", description: "", hourly_rate_pesos: 1 },
      { name: "Beta", slug: "beta", description: "", hourly_rate_pesos: 1 },
    ])
    .execute();
  app = new OpenAPIHono<HonoEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db!);
    await next();
  });
  app.route("/v1", routes);
});
after(async () => {
  await db?.destroy();

  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
test("admin endpoints enforce sessions, global summary, filters, scoped paging and do not mutate knowledge", async () => {
  const request = (path: string, cookie?: string) =>
    app.request(path, { headers: cookie ? { cookie } : {} });

  assert.equal((await request("/v1/admin/ai/knowledge")).status, 401);
  assert.equal(
    (await request("/v1/admin/ai/knowledge", customerCookie)).status,
    403,
  );
  const beforeCount = await db!
    .selectFrom("catalog_knowledge")
    .selectAll()
    .execute();
  const first = await request(
    "/v1/admin/ai/knowledge?status=attention&limit=1",
    adminCookie,
  );
  assert.equal(first.status, 200);
  const page = await first.json();
  assert.equal(page.summary.services.total, 2);
  assert.equal(page.summary.attention, 2);
  assert.equal(page.filteredCount, 2);
  assert.equal(page.listings[0].name, "Alpha");
  assert.equal(page.listings[0].status, "pending");
  const next = await request(
    `/v1/admin/ai/knowledge?status=attention&limit=1&cursor=${page.nextCursor}`,
    adminCookie,
  );
  assert.equal((await next.json()).listings[0].name, "Beta");
  assert.equal(
    (
      await request(
        `/v1/admin/ai/knowledge?status=indexed&cursor=${page.nextCursor}`,
        adminCookie,
      )
    ).status,
    400,
  );
  const detail = await request(
    `/v1/admin/ai/knowledge/service/${page.listings[0].id}?limit=1`,
    adminCookie,
  );
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).chunks[0].key, "overview");
  assert.deepEqual(
    await db!.selectFrom("catalog_knowledge").selectAll().execute(),
    beforeCount,
  );
});

test("detail exposes withdrawn chunks without counting or serving removed media", async () => {
  const service = await db!
    .selectFrom("services")
    .select("id")
    .where("name", "=", "Alpha")
    .executeTakeFirstOrThrow();
  await db!
    .insertInto("catalog_knowledge")
    .values({
      service_id: service.id,
      package_id: null,
      chunk_key: "photo:removed",
      content_markdown: "Old photo context",
      content_hash: "old",
      media_id: null,
      embedding: null,
      embedding_model: null,
      embedded_at: null,
    })
    .execute();
  const before = await db!
    .selectFrom("catalog_knowledge")
    .selectAll()
    .execute();
  const response = await app.request(
    `/v1/admin/ai/knowledge/service/${service.id}`,
    { headers: { cookie: adminCookie } },
  );
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.listing.status, "needs-refresh");
  assert.equal(detail.listing.expectedChunks, 1);
  assert.equal(detail.listing.indexedChunks, 0);
  assert.equal(detail.listing.photoChunks, 0);

  const removed = detail.chunks.find(
    (chunk: { key: string }) => chunk.key === "photo:removed",
  );

  assert.equal(removed.withdrawn, true);
  assert.equal(removed.contentMarkdown, "Old photo context");
  assert.equal(removed.mediaUrl, null);
  assert.deepEqual(
    await db!.selectFrom("catalog_knowledge").selectAll().execute(),
    before,
  );
});
