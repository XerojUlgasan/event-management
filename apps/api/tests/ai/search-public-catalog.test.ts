import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Image } from "imagescript";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import {
  CatalogSearchPhotoUnavailable,
  searchPublicCatalogInputSchema,
  searchPublicCatalogService,
} from "../../src/services/ai/search-public-catalog.js";
import { KnowledgeSearchUnavailable } from "../../src/services/ai/retrieval/search-catalog-knowledge.js";
import { syncCatalogKnowledge } from "../../src/services/ai/workflows/sync-catalog-knowledge.js";
import { catalogKnowledgeDigest } from "../../src/services/ai/catalog-knowledge-hash.js";
import { saveCatalogKnowledgeEmbeddingData } from "../../src/data/ai/save-catalog-knowledge-embedding.js";
import { setTestConfig } from "../helpers/set-test-config.js";

const database = `em_public_search_${randomUUID().replaceAll("-", "")}`;

const originalFetch = globalThis.fetch;
const originalKey = process.env.AI_GATEWAY_API_KEY;
const originalModel = process.env.EMBEDDING_MODEL;
const model = "google/gemini-embedding-2";
let admin: Pool | undefined;
let db: Kysely<DB>;
let calls = 0;
let fail = false;
let embeddingRequest: unknown;

const vector = (x: number, y: number) => [x, y, ...Array(766).fill(0)];

before(async () => {
  setTestConfig({ AI_GATEWAY_API_KEY: "fixture-key" });
  setTestConfig({ EMBEDDING_MODEL: model });
  globalThis.fetch = async (_input, init) => {
    calls++;
    embeddingRequest = JSON.parse(String(init?.body));

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

  if (originalKey === undefined)
    setTestConfig({ AI_GATEWAY_API_KEY: undefined });
  else setTestConfig({ AI_GATEWAY_API_KEY: originalKey });

  if (originalModel === undefined)
    setTestConfig({ EMBEDDING_MODEL: undefined });
  else setTestConfig({ EMBEDDING_MODEL: originalModel });

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

  for (const row of rows) await saveIndexedChunk(row, embedding);
}

async function saveIndexedChunk(
  row: Awaited<ReturnType<typeof syncCatalogKnowledge>>[number],
  embedding: number[],
) {
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

  for (let i = 0; i < 6; i++)
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
  assert.equal(first.results.length, 3);
  assert.ok(first.nextCursor);
  const second = await searchPublicCatalogService({
    db,
    input: { catalogType: "package", pax: 40, cursor: first.nextCursor },
  });
  assert.equal(second.results.length, 3);
  assert.equal(second.nextCursor, null);
  assert.equal(
    new Set([...first.results, ...second.results].map((r) => r.id)).size,
    6,
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

  const legacy = await db
    .insertInto("packages")
    .values({
      name: "Legacy",
      slug: "legacy",
      description: "garden",
      max_guests: 60,
      price: 200,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await index("package", legacy.id, vector(1, 0));
  await db
    .updateTable("catalog_knowledge")
    .set({ chunk_key: "overview" })
    .where("package_id", "=", legacy.id)
    .where("chunk_key", "=", "text")
    .execute();

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
  assert.equal(first.results.length, 3);
  assert.ok(first.nextCursor);
  const second = await searchPublicCatalogService({
    db,
    input: { ...input, query: "garden", cursor: first.nextCursor },
  });
  assert.equal(second.results.length, 3);
  assert.ok(second.nextCursor);
  const third = await searchPublicCatalogService({
    db,
    input: { ...input, cursor: second.nextCursor },
  });
  assert.equal(third.results.length, 1);
  assert.equal(third.nextCursor, null);
  assert.equal(
    new Set(
      [...first.results, ...second.results, ...third.results].map((r) => r.id),
    ).size,
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

async function photoCanvas(altLabels: string[]) {
  const mediaId = randomUUID();

  if (altLabels.length)
    await db
      .insertInto("media_assets")
      .values({
        id: mediaId,
        kind: "image",
        source: "upload",
        url: null,
        storage_key: `catalog-media/${mediaId}`,
        mime_type: "image/png",
        byte_size: 1,
        created_by: null,
      })
      .execute();

  const widgets = altLabels.map((alt, position) => ({
    id: randomUUID(),
    type: "photo",
    x: 0,
    y: position * 5,
    w: 6,
    h: 5,
    markdown: "",
    mediaId,
    alt,
    caption: "",
    autoplay: false,
  }));

  const canvas = [{ id: randomUUID(), title: "Examples", widgets }];

  return { canvas, widgets };
}

test("photo search embeds original PNG bytes and optional focus once, then selects the best fresh public photo per filtered package", async () => {
  async function packageExample(
    slug: string,
    photos: number[][],
    filters: { price?: number; guests?: number } = {},
  ) {
    const { canvas, widgets } = await photoCanvas(
      photos.map((_, position) => `${slug} photo ${position + 1}`),
    );

    const { id } = await db
      .insertInto("packages")
      .values({
        name: slug,
        slug,
        description: "Fixture",
        max_guests: filters.guests ?? 60,
        price: filters.price ?? 300,
        canvas: sql`${JSON.stringify(canvas)}::jsonb`,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const rows = await db
      .transaction()
      .execute((trx) => syncCatalogKnowledge(trx, { kind: "package", id }));

    for (const row of rows) {
      const position = widgets.findIndex(
        (widget) => row.chunk_key === `photo:${widget.id}`,
      );

      await saveIndexedChunk(row, photos[position] ?? vector(1, 0));
    }

    return id;
  }

  await packageExample("photo-best", [vector(0.8, 0.6), vector(0.95, 0.31)]);
  await packageExample("photo-second", [vector(0.6, 0.8)]);
  await packageExample("photo-third", [vector(0.4, 0.92)]);
  await packageExample("photo-fourth", [vector(0.2, 0.98)]);
  await packageExample("photo-over-budget", [vector(1, 0)], { price: 301 });
  await packageExample("photo-under-budget", [vector(1, 0)], { price: 299 });
  await packageExample("photo-too-small", [vector(1, 0)], { guests: 49 });
  await packageExample("photo-text-only", []);
  const stale = await packageExample("photo-stale", [vector(1, 0)]);
  const withdrawn = await packageExample("photo-withdrawn", [vector(1, 0)]);
  const archived = await packageExample("photo-archived", [vector(1, 0)]);
  const incompatible = await packageExample("photo-incompatible", [
    vector(1, 0),
  ]);

  await db
    .updateTable("catalog_knowledge")
    .set({ content_hash: "stale" })
    .where("package_id", "=", stale)
    .where("chunk_key", "like", "photo:%")
    .execute();
  await db
    .updateTable("packages")
    .set({ canvas: sql`'[]'::jsonb` })
    .where("id", "=", withdrawn)
    .execute();
  await db
    .updateTable("packages")
    .set({ archived_at: new Date() })
    .where("id", "=", archived)
    .execute();
  await db
    .updateTable("catalog_knowledge")
    .set({ embedding_model: "incompatible" })
    .where("package_id", "=", incompatible)
    .where("chunk_key", "like", "photo:%")
    .execute();

  const bytes = await new Image(2, 2).fill(0xff0088ff).encodePNG();
  const photoAttachmentId = randomUUID();
  const input = {
    catalogType: "package" as const,
    photoAttachmentId: photoAttachmentId.toUpperCase(),
    query: " floral arch ",
    pax: 50,
    minPricePesos: 300,
    maxPricePesos: 300,
  };
  const controller = new AbortController();
  let reads = 0;

  const readPhoto = async (id: string, signal?: AbortSignal) => {
    reads++;
    assert.equal(id, photoAttachmentId);
    assert.equal(signal, controller.signal);

    return { bytes, mimeType: "image/png" };
  };

  const options = { db, readPhoto, abortSignal: controller.signal };
  const priorCalls = calls;
  const first = await searchPublicCatalogService({ ...options, input });
  assert.equal(reads, 1);
  assert.equal(calls, priorCalls + 1);
  assert.deepEqual(embeddingRequest, {
    values: ["floral arch"],
    dimensions: 768,
    providerOptions: {
      google: {
        content: [
          [
            {
              inlineData: {
                mimeType: "image/png",
                data: Buffer.from(bytes).toString("base64"),
              },
            },
          ],
        ],
      },
    },
  });
  assert.equal(first.photoAttachmentId, photoAttachmentId);
  assert.deepEqual(
    first.results.map((result) => result.name),
    ["photo-best", "photo-second", "photo-third"],
  );
  assert.equal(first.results[0]?.evidence[0]?.kind, "photo");
  assert.match(
    first.results[0]?.evidence[0]?.excerpt ?? "",
    /photo-best photo 2/,
  );
  assert.ok(
    (first.results[0]?.evidence[0]?.similarity ?? 0) >
      (first.results[1]?.evidence[0]?.similarity ?? 1),
  );
  assert.ok(first.nextCursor);

  for (const changed of [
    { photoAttachmentId: randomUUID() },
    { photoAttachmentId: undefined },
    { query: "other detail" },
    { maxPricePesos: 301 },
  ])
    await assert.rejects(
      searchPublicCatalogService({
        ...options,
        input: { ...input, ...changed, cursor: first.nextCursor },
      }),
      /Invalid pagination cursor/,
    );

  assert.equal(reads, 1);
  assert.equal(calls, priorCalls + 1);

  const second = await searchPublicCatalogService({
    ...options,
    input: {
      ...input,
      photoAttachmentId,
      query: "floral arch",
      cursor: first.nextCursor,
    },
  });
  assert.deepEqual(
    second.results.map((result) => result.name),
    ["photo-fourth"],
  );
  assert.equal(second.nextCursor, null);
  assert.equal(reads, 2);
  assert.equal(calls, priorCalls + 2);

  const webp = await new Image(2, 2).fill(0xff0088ff).encodeWebP();

  const readWebp = async () => ({ bytes: webp, mimeType: "image/webp" });

  const webpFirst = await searchPublicCatalogService({
    db,
    input,
    readPhoto: readWebp,
  });
  assert.ok(webpFirst.nextCursor);

  const requestImage = () =>
    (
      embeddingRequest as {
        providerOptions: {
          google: { content: { inlineData: { mimeType: string } }[][] };
        };
      }
    ).providerOptions.google.content[0]![0]!.inlineData.mimeType;

  await searchPublicCatalogService({
    db,
    input: { ...input, cursor: webpFirst.nextCursor },
    readPhoto: readWebp,
  });
  assert.equal(requestImage(), "image/webp");
  // Before native WebP search, photo cursors stored only the item ID and score.
  await searchPublicCatalogService({
    db,
    input: { ...input, cursor: first.nextCursor },
    readPhoto: readWebp,
  });
  assert.equal(requestImage(), "image/png");
});

test("photo-only service search embeds the original WebP, retains pricing type and filters, and permits an empty eligible corpus", async () => {
  const { canvas } = await photoCanvas(["Fixture stage"]);

  for (const [slug, fixed] of [
    ["photo-fixed", 500],
    ["photo-hourly", null],
  ] as const) {
    const { id } = await db
      .insertInto("services")
      .values({
        name: slug,
        slug,
        description: "",
        fixed_price_pesos: fixed,
        included_hours: fixed ? 3 : null,
        hourly_rate_pesos: 75,
        canvas: sql`${JSON.stringify(canvas)}::jsonb`,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await index("service", id, vector(1, 0));
  }

  const webp = await new Image(3, 2).fill(0xff0088ff).encodeWebP();
  const photoAttachmentId = randomUUID();
  const input = {
    catalogType: "service" as const,
    photoAttachmentId,
    pricingType: "fixed" as const,
    minPricePesos: 500,
    maxPricePesos: 500,
  };

  const readPhoto = async () => ({ bytes: webp, mimeType: "image/webp" });

  const priorCalls = calls;
  const page = await searchPublicCatalogService({ db, input, readPhoto });
  assert.equal(calls, priorCalls + 1);
  assert.equal(page.photoAttachmentId, photoAttachmentId);
  assert.deepEqual(
    page.results.map((result) => result.name),
    ["photo-fixed"],
  );

  const request = embeddingRequest as {
    values: string[];
    dimensions: number;
    providerOptions: {
      google: {
        content: { inlineData: { mimeType: string; data: string } }[][];
      };
    };
  };
  assert.deepEqual(request.values, [""]);
  assert.equal(request.dimensions, 768);
  const image = request.providerOptions.google.content[0]![0]!.inlineData;
  assert.equal(image.mimeType, "image/webp");
  assert.equal(image.data, Buffer.from(webp).toString("base64"));

  const empty = await searchPublicCatalogService({
    db,
    input: { ...input, minPricePesos: 501, maxPricePesos: 501 },
    readPhoto,
  });
  assert.deepEqual(empty, { photoAttachmentId, results: [], nextCursor: null });
});

test("photo search skips embedding on unavailable or invalid bytes and distinguishes provider failure", async () => {
  const input = {
    catalogType: "package" as const,
    photoAttachmentId: randomUUID(),
  };
  const priorCalls = calls;
  await assert.rejects(
    searchPublicCatalogService({ db, input }),
    CatalogSearchPhotoUnavailable,
  );
  await assert.rejects(
    searchPublicCatalogService({ db, input, readPhoto: async () => null }),
    CatalogSearchPhotoUnavailable,
  );
  await assert.rejects(
    searchPublicCatalogService({
      db,
      input,
      readPhoto: async () => ({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
      }),
    }),
    CatalogSearchPhotoUnavailable,
  );
  assert.equal(calls, priorCalls);

  const bytes = await new Image(1, 1).encodePNG();
  fail = true;

  try {
    await assert.rejects(
      searchPublicCatalogService({
        db,
        input,
        readPhoto: async () => ({ bytes, mimeType: "image/png" }),
      }),
      KnowledgeSearchUnavailable,
    );
    assert.equal(calls, priorCalls + 1);
  } finally {
    fail = false;
  }
});
