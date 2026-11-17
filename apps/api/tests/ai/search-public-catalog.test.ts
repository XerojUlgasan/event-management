import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import {
  searchPublicCatalogInputSchema,
  searchPublicCatalogService,
} from "../../src/services/ai/search-public-catalog.js";
import { syncCatalogKnowledge } from "../../src/services/ai/workflows/sync-catalog-knowledge.js";
import { catalogKnowledgeDigest } from "../../src/services/ai/catalog-knowledge-hash.js";
import { saveCatalogKnowledgeEmbeddingData } from "../../src/data/ai/save-catalog-knowledge-embedding.js";

const database = `em_public_search_${randomUUID().replaceAll("-", "")}`;
const originalFetch = globalThis.fetch;
const originalKey = process.env.AI_GATEWAY_API_KEY;
const originalModel = process.env.EMBEDDING_MODEL;
const model = "google/gemini-embedding-2";
let admin: Pool | undefined;
let db: Kysely<DB>;
let calls = 0;
let fail = false;
const vector = (x: number, y: number) => [x, y, ...Array(766).fill(0)];

before(async () => {
  process.env.AI_GATEWAY_API_KEY = "fixture-key";
  process.env.EMBEDDING_MODEL = model;
  globalThis.fetch = async () => {
    calls++;
    return fail
      ? new Response("failed", { status: 503 })
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

async function index(
  kind: "package" | "service",
  id: string,
  embedding: number[],
) {
  const rows = await db
    .transaction()
    .execute((trx) => syncCatalogKnowledge(trx, { kind, id }));
  for (const row of rows) {
    const hash = `${row.content_hash}:${catalogKnowledgeDigest(row.content_markdown)}`;
    await db
      .updateTable("catalog_knowledge")
      .set({ content_hash: hash })
      .where("id", "=", row.id)
      .execute();
    await saveCatalogKnowledgeEmbeddingData(db, row.id, hash, {
      model,
      embedding,
    });
  }
}

test("validates filters and never embeds queryless searches", async () => {
  assert.equal(
    searchPublicCatalogInputSchema.safeParse({
      catalogType: "service",
      minPricePesos: 1,
    }).success,
    false,
  );
  assert.equal(
    searchPublicCatalogInputSchema.safeParse({ catalogType: "service", pax: 5 })
      .success,
    false,
  );
  assert.equal(
    searchPublicCatalogInputSchema.safeParse({
      catalogType: "package",
      pricingType: "fixed",
    }).success,
    false,
  );
  assert.equal(
    searchPublicCatalogInputSchema.safeParse({
      catalogType: "package",
      minPricePesos: 10,
      maxPricePesos: 9,
    }).success,
    false,
  );
  for (let i = 0; i < 7; i++)
    await db
      .insertInto("packages")
      .values({
        name: `Package ${i}`,
        slug: `package-${i}`,
        description: "description",
        max_guests: 50,
        price: 100,
      })
      .execute();
  await assert.rejects(
    db
      .insertInto("packages")
      .values({
        name: "Unpublished",
        slug: "unpublished",
        description: "",
        max_guests: 50,
        price: 100,
        published_at: null,
      })
      .execute(),
    /packages_type_owner_check/,
  );
  await db
    .insertInto("packages")
    .values({
      name: "Archived",
      slug: "archived",
      description: "",
      max_guests: 50,
      price: 100,
      archived_at: new Date(),
    })
    .execute();
  const first = await searchPublicCatalogService({
    db,
    input: { catalogType: "package", pax: 40 },
  });
  assert.equal(first.results.length, 5);
  assert.ok(first.nextCursor);
  const second = await searchPublicCatalogService({
    db,
    input: { catalogType: "package", pax: 40, cursor: first.nextCursor },
  });
  assert.equal(second.results.length, 2);
  assert.equal(
    new Set([...first.results, ...second.results].map((r) => r.id)).size,
    7,
  );
  await assert.rejects(
    searchPublicCatalogService({
      db,
      input: { catalogType: "package", pax: 41, cursor: first.nextCursor },
    }),
  );
  assert.equal(calls, 0);
});

test("filters before ranking, deduplicates listings, excludes stale and private chunks, and propagates provider failures", async () => {
  const p = await db
    .insertInto("packages")
    .values({
      name: "Match",
      slug: "match",
      description: "garden",
      max_guests: 60,
      price: 200,
      canvas: sql`${JSON.stringify([{ id: randomUUID(), title: "Garden", widgets: [{ id: randomUUID(), type: "markdown", x: 0, y: 0, w: 12, h: 4, markdown: "Garden details", mediaId: null, alt: "", caption: "", autoplay: false }] }])}::jsonb`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const low = await db
    .insertInto("packages")
    .values({
      name: "Too small",
      slug: "small",
      description: "garden",
      max_guests: 10,
      price: 200,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const stale = await db
    .insertInto("packages")
    .values({
      name: "Stale",
      slug: "stale",
      description: "garden",
      max_guests: 60,
      price: 200,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const customer = await db
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      password_hash: "unused",
      role: "customer",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const booking = await db
    .insertInto("booking_requests")
    .values({
      reference: `fixture-${randomUUID()}`,
      customer_id: customer.id,
      package_id: p.id,
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
  const privatePackage = await db
    .insertInto("packages")
    .values({
      name: "Private",
      slug: "private",
      description: "garden",
      max_guests: 60,
      price: 200,
      package_type: "custom",
      custom_for_booking_request_id: booking.id,
      published_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const privateChunk = await db
    .insertInto("catalog_knowledge")
    .values({
      package_id: privatePackage.id,
      service_id: null,
      chunk_key: "overview",
      content_markdown: "private garden",
      content_hash: "private",
      media_id: null,
      embedding: null,
      embedding_model: null,
      embedded_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await saveCatalogKnowledgeEmbeddingData(db, privateChunk.id, "private", {
    model,
    embedding: vector(1, 0),
  });
  for (const id of [p.id, low.id, stale.id])
    await index("package", id, vector(1, 0));
  await db
    .updateTable("packages")
    .set({ description: "changed" })
    .where("id", "=", stale.id)
    .execute();
  const result = await searchPublicCatalogService({
    db,
    input: {
      catalogType: "package",
      query: " garden ",
      pax: 50,
      minPricePesos: 200,
      maxPricePesos: 200,
    },
  });
  assert.deepEqual(
    result.results.map((r) => r.name),
    ["Match"],
  );
  assert.equal(result.results[0]?.url, "/packages/match");
  assert.ok(result.results[0]?.evidence.length);
  fail = true;
  await assert.rejects(
    searchPublicCatalogService({
      db,
      input: { catalogType: "package", query: "garden" },
    }),
  );
  fail = false;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    searchPublicCatalogService({
      db,
      input: { catalogType: "package", query: "garden" },
      abortSignal: controller.signal,
    }),
  );
});

test("semantic cursor paginates equal scores and is bound to the normalized query and filters", async () => {
  for (let i = 0; i < 7; i++) {
    const service = await db
      .insertInto("services")
      .values({
        name: `Semantic ${i}`,
        slug: `semantic-${i}`,
        description: "garden",
        hourly_rate_pesos: 200,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await index("service", service.id, vector(1, 0));
  }
  const archived = await db
    .insertInto("services")
    .values({
      name: "Archived semantic",
      slug: "archived-semantic",
      description: "garden",
      hourly_rate_pesos: 200,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await index("service", archived.id, vector(1, 0));
  await db
    .updateTable("services")
    .set({ archived_at: new Date() })
    .where("id", "=", archived.id)
    .execute();
  const input = {
    catalogType: "service" as const,
    query: " garden ",
    pricingType: "hourly" as const,
    minPricePesos: 200,
  };
  const first = await searchPublicCatalogService({ db, input });
  assert.equal(first.results.length, 5);
  assert.ok(first.nextCursor);
  const second = await searchPublicCatalogService({
    db,
    input: { ...input, query: "garden", cursor: first.nextCursor },
  });
  assert.equal(second.results.length, 2);
  assert.equal(
    new Set([...first.results, ...second.results].map((r) => r.id)).size,
    7,
  );
  await assert.rejects(
    searchPublicCatalogService({
      db,
      input: { ...input, query: "other", cursor: first.nextCursor },
    }),
  );
  await assert.rejects(
    searchPublicCatalogService({
      db,
      input: { ...input, minPricePesos: 201, cursor: first.nextCursor },
    }),
  );
});

test("service price filters use the selected rate and return full rate units", async () => {
  await db
    .insertInto("services")
    .values([
      {
        name: "Fixed",
        slug: "fixed",
        description: "",
        fixed_price_pesos: 500,
        included_hours: 3,
        hourly_rate_pesos: 100,
      },
      {
        name: "Hourly",
        slug: "hourly",
        description: "",
        hourly_rate_pesos: 100,
      },
    ])
    .execute();
  const fixed = await searchPublicCatalogService({
    db,
    input: { catalogType: "service", pricingType: "fixed", minPricePesos: 500 },
  });
  assert.deepEqual(
    fixed.results.map((r) => r.name),
    ["Fixed"],
  );
  assert.deepEqual(fixed.results[0]?.price, {
    type: "fixed",
    amountPesos: 500,
    includedHours: 3,
    additionalHourlyRatePesos: 100,
    unit: "fixed",
    currency: "PHP",
  });
  const hourly = await searchPublicCatalogService({
    db,
    input: {
      catalogType: "service",
      pricingType: "hourly",
      maxPricePesos: 100,
    },
  });
  assert.deepEqual(
    hourly.results.map((r) => r.name),
    ["Hourly"],
  );
});
