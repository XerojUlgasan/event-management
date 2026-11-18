import "dotenv/config";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../src/types/hono.js";
import routes from "../../src/controllers/ai/index.js";
import { searchCatalogKnowledgeService } from "../../src/services/ai/retrieval/search-catalog-knowledge.js";
import { indexPendingCatalogKnowledgeService } from "../../src/services/ai/workflows/index-pending-catalog-knowledge.js";
import { hashSessionToken } from "../../src/utils/session.js";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import { listCatalogKnowledgeData } from "../../src/data/ai/list-catalog-knowledge.js";
import { listCatalogKnowledgeOwnersData } from "../../src/data/ai/list-catalog-knowledge-owners.js";
import type { CatalogKnowledgeOwner } from "../../src/data/ai/catalog-knowledge-types.js";
import { createPackageService } from "../../src/services/packages/create-package.js";
import { updatePackageService } from "../../src/services/packages/update-package.js";
import { archivePackageService } from "../../src/services/packages/archive-package.js";
import { createServiceService } from "../../src/services/services/create-service.js";
import { updateServiceService } from "../../src/services/services/update-service.js";
import { archiveServiceService } from "../../src/services/services/archive-service.js";
import { deleteServiceService } from "../../src/services/services/delete-service.js";
import { refreshCatalogEmbeddingsService } from "../../src/services/ai/workflows/refresh-catalog-embeddings.js";
import { waitForCatalogEmbeddingRefresh } from "../../src/services/ai/workflows/schedule-catalog-embedding-refresh.js";
import { readCatalogEmbeddingImage } from "../../src/services/ai/retrieval/read-catalog-embedding-image.js";
import { syncCatalogKnowledge } from "../../src/services/ai/workflows/sync-catalog-knowledge.js";
import {
  sectionsSchema,
  type Content,
} from "../../src/controllers/packages/schemas.js";
import type { ServiceContent } from "../../src/controllers/services/schemas.js";
import type { Selectable } from "kysely";
import type { MediaAssets } from "../../src/db/types.js";

const database = `em_catalog_embeddings_${randomUUID().replaceAll("-", "")}`;
const embeddingModel = "google/gemini-embedding-2";
const samplePhotoUrl = "/images/wedding.jpg";
const uploadedPhotoBytes = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4,
]);
const originalFetch = globalThis.fetch;
const environmentNames = [
  "AI_GATEWAY_API_KEY",
  "EMBEDDING_MODEL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SECRET_KEYS",
  "SUPABASE_STORAGE_BUCKET",
] as const;
const originalEnvironment = new Map(
  environmentNames.map((name) => [name, process.env[name]]),
);

type GatewayRequest = {
  values: string[];
  dimensions: number;
  providerOptions?: {
    google: {
      content: Array<Array<{ inlineData: { mimeType: string; data: string } }>>;
    };
  };
};

type GatewayCall = { url: URL; body: GatewayRequest };
type GatewayHandler = (call: GatewayCall) => Response | Promise<Response>;

let db: Kysely<DB> | undefined;
let adminPool: Pool | undefined;
let testPool: Pool | undefined;
let storageServer: Server | undefined;
let storageRequests = 0;
let gatewayCalls: GatewayCall[] = [];
let gatewayHandler: GatewayHandler = () => gatewayResponse();

function gatewayResponse() {
  const vector = [1, ...Array(767).fill(0)];
  return new Response(JSON.stringify({ embeddings: [vector], warnings: [] }), {
    headers: { "Content-Type": "application/json" },
  });
}

function setGatewayHandler(handler: GatewayHandler = () => gatewayResponse()) {
  gatewayCalls = [];
  gatewayHandler = handler;
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return new URL(input.url);
  if (input instanceof URL) return input;
  return new URL(input);
}

async function installGatewayInterceptor() {
  globalThis.fetch = async (input, init) => {
    const url = requestUrl(input);
    if (url.hostname !== "ai-gateway.vercel.sh")
      return originalFetch(input, init);
    if (!url.pathname.toLowerCase().includes("embedding"))
      throw new Error(
        "Unexpected AI Gateway endpoint in catalog embedding test",
      );
    const rawBody =
      init?.body ??
      (input instanceof Request ? await input.clone().text() : undefined);
    assert.ok(
      rawBody !== undefined,
      "AI Gateway request must include JSON body",
    );
    const body = JSON.parse(String(rawBody)) as GatewayRequest;
    assert.equal(body.dimensions, 768);
    const call = { url, body };
    gatewayCalls.push(call);
    return gatewayHandler(call);
  };
}

function getDb() {
  if (!db)
    throw new Error("Disposable catalog embedding database is not ready");
  return db;
}

function mediaWidget(
  id: string,
  mediaId: string,
  values: { alt: string; caption?: string; x?: number; y?: number },
) {
  return {
    id,
    type: "photo",
    x: values.x ?? 0,
    y: values.y ?? 0,
    w: 6,
    h: 5,
    markdown: "",
    mediaId,
    alt: values.alt,
    caption: values.caption ?? "",
    autoplay: false,
  };
}

function markdownWidget(id: string, markdown: string, x = 0, y = 0) {
  return {
    id,
    type: "markdown",
    x,
    y,
    w: 12,
    h: 4,
    markdown,
    mediaId: null,
    alt: "",
    caption: "",
    autoplay: false,
  };
}

function videoWidget(id: string, mediaId: string) {
  return {
    id,
    type: "video",
    x: 0,
    y: 9,
    w: 12,
    h: 6,
    markdown: "",
    mediaId,
    alt: "",
    caption: "Video content is excluded",
    autoplay: false,
  };
}

function section(title: string, widgets: unknown[]) {
  return { id: randomUUID(), title, widgets };
}

async function createPackageRow(options: {
  name: string;
  packageType?: string;
  archived?: boolean;
}) {
  const row = await getDb()
    .insertInto("packages")
    .values({
      slug: `${options.name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}`,
      name: options.name,
      description: `Description for ${options.name}`,
      max_guests: 40,
      price: 15000,
      package_type: options.packageType ?? "catalog",
      archived_at: options.archived ? new Date() : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function createServiceRow(options: { name: string; archived?: boolean }) {
  const row = await getDb()
    .insertInto("services")
    .values({
      slug: `${options.name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}`,
      name: options.name,
      description: `Description for ${options.name}`,
      hourly_rate_pesos: 800,
      fixed_price_pesos: null,
      included_hours: null,
      archived_at: options.archived ? new Date() : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function createCustomPackageRow(name: string) {
  const sourcePackageId = await createPackageRow({
    name: `${name} source catalog package`,
  });
  const customerId = await createAdminId();
  const bookingRequest = await getDb()
    .insertInto("booking_requests")
    .values({
      reference: `fixture-${randomUUID()}`,
      customer_id: customerId,
      package_id: sourcePackageId,
      event_type: "Wedding",
      preferred_date: "2027-06-01",
      time_zone: "Asia/Manila",
      guest_count: 40,
      contact_name: "Fixture customer",
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

  const row = await getDb()
    .insertInto("packages")
    .values({
      slug: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}`,
      name,
      description: `Description for ${name}`,
      max_guests: 40,
      price: 15000,
      package_type: "custom",
      custom_for_booking_request_id: bookingRequest.id,
      published_at: null,
      archived_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function createMediaAsset(source: "sample" | "upload") {
  const id = randomUUID();
  await getDb()
    .insertInto("media_assets")
    .values({
      id,
      kind: "image",
      source,
      url: source === "sample" ? samplePhotoUrl : null,
      storage_key: source === "upload" ? `catalog-media/${id}` : null,
      mime_type: source === "upload" ? "image/png" : "image/jpeg",
      byte_size: source === "upload" ? uploadedPhotoBytes.length : null,
      created_by: null,
    })
    .execute();
  return id;
}

async function setCanvas(owner: CatalogKnowledgeOwner, sections: unknown[]) {
  const table = owner.kind === "package" ? "packages" : "services";
  await getDb()
    .updateTable(table)
    .set({ canvas: sql`${JSON.stringify(sections)}::jsonb` })
    .where("id", "=", owner.id)
    .executeTakeFirstOrThrow();
}

function packageContent(name: string, markdown = "Package details") {
  return {
    name,
    description: `${name} description`,
    maxGuests: 40,
    price: { kind: "fixed", currency: "PHP", amountMinor: 150000 },
    sections: [
      {
        id: randomUUID(),
        title: "Celebration",
        widgets: [
          {
            id: randomUUID(),
            type: "photo",
            x: 0,
            y: 0,
            w: 6,
            h: 5,
            markdown: "",
            media: { kind: "image", source: "sample", url: samplePhotoUrl },
            alt: `${name} table setting`,
            caption: "",
            autoplay: false,
          },
          {
            id: randomUUID(),
            type: "markdown",
            x: 0,
            y: 5,
            w: 12,
            h: 4,
            markdown,
            media: null,
            alt: "",
            caption: "",
            autoplay: false,
          },
        ],
      },
    ],
  } satisfies Content;
}

function serviceContent(name: string, markdown = "Service details") {
  return {
    name,
    description: `${name} description`,
    hourlyRatePesos: 800,
    fixedPricePesos: null,
    includedHours: null,
    sections: [
      {
        id: randomUUID(),
        title: "Service details",
        widgets: [
          {
            id: randomUUID(),
            type: "photo",
            x: 0,
            y: 0,
            w: 6,
            h: 5,
            markdown: "",
            media: { kind: "image", source: "sample", url: samplePhotoUrl },
            alt: `${name} photo`,
            caption: "",
            autoplay: false,
          },
          {
            id: randomUUID(),
            type: "markdown",
            x: 0,
            y: 5,
            w: 12,
            h: 4,
            markdown,
            media: null,
            alt: "",
            caption: "",
            autoplay: false,
          },
        ],
      },
    ],
  } satisfies ServiceContent;
}

async function knowledgeRows(owner: CatalogKnowledgeOwner) {
  return listCatalogKnowledgeData(getDb(), owner);
}

async function createAdminId() {
  const row = await getDb()
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      password_hash: "fixture-password-hash",
      role: "admin",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
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
  adminPool = new Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  testPool = new Pool({ ...connection, database });
  db = new Kysely<DB>({ dialect: new PostgresDialect({ pool: testPool }) });
  const migrationRoot = new URL("../../prisma/migrations/", import.meta.url);
  for (const migration of (
    await readdir(migrationRoot, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))) {
    await testPool.query(
      await readFile(
        new URL(`${migration.name}/migration.sql`, migrationRoot),
        "utf8",
      ),
    );
  }

  storageServer = createServer((request, response) => {
    if (
      request.method !== "GET" ||
      !request.url?.startsWith(
        "/storage/v1/object/event-management/catalog-media/",
      )
    ) {
      response.writeHead(404).end();
      return;
    }
    storageRequests++;
    response
      .writeHead(200, { "Content-Type": "image/png" })
      .end(uploadedPhotoBytes);
  });
  await new Promise<void>((resolve) =>
    storageServer?.listen(0, "127.0.0.1", resolve),
  );
  const address = storageServer.address();
  assert.ok(address && typeof address !== "string");
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-storage-key";
  process.env.SUPABASE_STORAGE_BUCKET = "event-management";
  process.env.AI_GATEWAY_API_KEY = "fixture-gateway-key";
  process.env.EMBEDDING_MODEL = embeddingModel;
  await installGatewayInterceptor();
});

after(async () => {
  if (db) await waitForCatalogEmbeddingRefresh(db).catch(() => {});
  await db?.destroy();
  await new Promise<void>((resolve) => {
    if (storageServer?.listening) storageServer.close(() => resolve());
    else resolve();
  });
  if (adminPool) {
    await adminPool.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await adminPool.end();
  }
  globalThis.fetch = originalFetch;
  for (const name of environmentNames) {
    const value = originalEnvironment.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("admin indexing traverses pending chunks, advances failures and retries", async () => {
  const app = new OpenAPIHono<HonoEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.route("/v1", routes);
  async function session(role: string) {
    const token = randomUUID();
    const user = await getDb()
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        password_hash: "unused",
        role,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await getDb()
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3600000),
      })
      .execute();
    return `em_session=${token}`;
  }
  const admin = await session("admin");
  const customer = await session("customer");
  const request = (body: object, cookie?: string) =>
    app.request("/v1/admin/ai/knowledge/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  assert.equal((await request({})).status, 401);
  assert.equal((await request({}, customer)).status, 403);
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  try {
    const empty = await request({}, admin);
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), {
      embedded: 0,
      unchanged: 0,
      superseded: 0,
      failed: 0,
      nextCursor: null,
    });
    const first = await createServiceRow({ name: "Index first" });
    const second = await createServiceRow({ name: "Index second" });
    const archived = await createServiceRow({
      name: "Index archived",
      archived: true,
    });
    const media = await createMediaAsset("upload");
    await setCanvas({ kind: "service", id: first }, [
      section("Photos", [mediaWidget(randomUUID(), media, { alt: "Fixture" })]),
    ]);
    let unlock = () => {};
    let locked = () => {};
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const holdingLock = getDb()
      .transaction()
      .execute(async (trx) => {
        await trx
          .selectFrom("services")
          .select("id")
          .where("id", "in", [first, second])
          .forUpdate()
          .execute();
        locked();
        await release;
      });
    await ready;
    try {
      const started = Date.now();
      const blocked = await request({}, admin);
      assert.equal(blocked.status, 503);
      assert.ok(Date.now() - started < 9_000);
      assert.deepEqual(await blocked.json(), {
        error: "Knowledge indexing is temporarily unavailable",
      });
    } finally {
      unlock();
      await holdingLock;
    }
    assert.equal((await request({}, admin)).status, 503);
    assert.equal((await request({ cursor: "bad" }, admin)).status, 400);
    process.env.AI_GATEWAY_API_KEY = "fixture-gateway-key";
    setGatewayHandler(
      () =>
        new Response(
          JSON.stringify({ error: { message: "private failure" } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
    );
    const failedResponse = await request({}, admin);
    assert.equal(failedResponse.status, 200);
    const failed = (await failedResponse.json()) as {
      failed: number;
      nextCursor: string | null;
    };
    assert.equal(failed.failed, 1);
    assert.ok(failed.nextCursor);
    setGatewayHandler();
    let cursor: string | null = failed.nextCursor;
    let embedded = 0;
    while (cursor) {
      const response = await request({ cursor }, admin);
      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        embedded: number;
        nextCursor: string | null;
      };
      embedded += result.embedded;
      cursor = result.nextCursor;
    }
    assert.equal(embedded, 2);
    assert.equal(gatewayCalls.length, 2);
    const retry = await request({}, admin);
    assert.equal(((await retry.json()) as { embedded: number }).embedded, 1);
    assert.equal(gatewayCalls.length, 3);
    const search = await searchCatalogKnowledgeService(getDb(), "fixture");
    assert.ok(search.results.some((item) => item.listing.id === first));
    assert.equal(gatewayCalls.length, 4);
    const done = await request({}, admin);
    assert.equal(
      ((await done.json()) as { nextCursor: string | null }).nextCursor,
      null,
    );
    assert.equal(gatewayCalls.length, 4);
    await getDb()
      .updateTable("catalog_knowledge")
      .set({ embedding_model: "fixture-old-model" })
      .where("service_id", "=", first)
      .where("chunk_key", "=", "overview")
      .execute();
    const outdated = await request({}, admin);
    assert.equal(outdated.status, 200);
    assert.equal(((await outdated.json()) as { embedded: number }).embedded, 1);
    assert.equal(gatewayCalls.length, 5);
    assert.equal(
      (await knowledgeRows({ kind: "service", id: archived })).length,
      0,
    );
    await setCanvas({ kind: "service", id: first }, []);
    const cleanup = await request({}, admin);
    assert.equal(cleanup.status, 200);
    assert.equal(
      (await knowledgeRows({ kind: "service", id: first })).length,
      1,
    );
    assert.equal(gatewayCalls.length, 5);
    await getDb()
      .deleteFrom("services")
      .where("id", "in", [first, second, archived])
      .execute();
  } finally {
    if (apiKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = apiKey;
    setGatewayHandler();
    storageRequests = 0;
  }
});

test("bounded index scan resumes across already indexed owners", async () => {
  const ids = Array.from(
    { length: 7 },
    (_, index) =>
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );
  for (const [index, id] of ids.entries()) {
    await getDb()
      .insertInto("services")
      .values({
        id,
        name: `Bounded ${index}`,
        slug: `bounded-${randomUUID()}`,
        description: "Fixture",
        hourly_rate_pesos: 1,
      })
      .execute();
    if (index < 6)
      await refreshCatalogEmbeddingsService({
        db: getDb(),
        owner: { kind: "service", id },
      });
  }
  setGatewayHandler();
  const signal = new AbortController().signal;
  const first = await indexPendingCatalogKnowledgeService(
    getDb(),
    undefined,
    signal,
  );
  assert.equal(first.embedded, 0);
  assert.ok(first.nextCursor);
  const second = await indexPendingCatalogKnowledgeService(
    getDb(),
    first.nextCursor,
    signal,
  );
  assert.equal(second.embedded, 1);
  assert.equal(gatewayCalls.length, 1);
  assert.ok(second.nextCursor);
  const last = await indexPendingCatalogKnowledgeService(
    getDb(),
    second.nextCursor,
    signal,
  );
  assert.equal(last.nextCursor, null);
  await getDb().deleteFrom("services").where("id", "in", ids).execute();
  setGatewayHandler();
});

test("embeds only eligible catalog owners with text and actual sample/upload images", async () => {
  setGatewayHandler();
  const packageId = await createPackageRow({ name: "Eligible package" });
  const activeServiceId = await createServiceRow({ name: "Active service" });
  const archivedServiceId = await createServiceRow({
    name: "Archived linked service",
    archived: true,
  });
  const customPackageId = await createCustomPackageRow("Custom package");
  const archivedPackageId = await createPackageRow({
    name: "Archived package",
    archived: true,
  });

  const sampleMediaId = await createMediaAsset("sample");
  const uploadedMediaId = await createMediaAsset("upload");
  const sampleWidgetId = randomUUID();
  const uploadedWidgetId = randomUUID();
  const packageMarkdownWidgetId = randomUUID();
  const videoMediaId = randomUUID();
  await getDb()
    .insertInto("media_assets")
    .values({
      id: videoMediaId,
      kind: "video",
      source: "upload",
      url: null,
      storage_key: `catalog-media/${videoMediaId}`,
      mime_type: "video/mp4",
      byte_size: 20,
      created_by: null,
    })
    .execute();
  await setCanvas({ kind: "package", id: packageId }, [
    section("Reception", [
      videoWidget(randomUUID(), videoMediaId),
      markdownWidget(
        packageMarkdownWidgetId,
        "Markdown from the reception section.",
        0,
        2,
      ),
      mediaWidget(sampleWidgetId, sampleMediaId, {
        alt: "Sample garden arch",
        caption: "Sample photo caption",
        x: 0,
        y: 0,
      }),
      mediaWidget(uploadedWidgetId, uploadedMediaId, {
        alt: "Uploaded table setting",
        caption: "Uploaded photo caption",
        x: 6,
        y: 0,
      }),
    ]),
  ]);
  await setCanvas({ kind: "service", id: activeServiceId }, [
    section("Details", [
      markdownWidget(randomUUID(), "Active service details."),
    ]),
  ]);

  const owners = await listCatalogKnowledgeOwnersData(getDb());
  assert.ok(
    owners.some((owner) => owner.kind === "package" && owner.id === packageId),
  );
  assert.ok(
    owners.some(
      (owner) => owner.kind === "service" && owner.id === activeServiceId,
    ),
  );
  assert.ok(!owners.some((owner) => owner.id === customPackageId));
  assert.ok(!owners.some((owner) => owner.id === archivedPackageId));
  assert.ok(!owners.some((owner) => owner.id === archivedServiceId));

  const packageOwner = { kind: "package", id: packageId } as const;
  const serviceOwner = { kind: "service", id: activeServiceId } as const;
  const packageResult = await refreshCatalogEmbeddingsService({
    db: getDb(),
    owner: packageOwner,
  });
  const serviceResult = await refreshCatalogEmbeddingsService({
    db: getDb(),
    owner: serviceOwner,
  });
  assert.equal(packageResult.embedded, 4);
  assert.equal(serviceResult.embedded, 2);
  assert.equal(gatewayCalls.length, 6);

  for (const owner of [
    { kind: "package", id: customPackageId },
    { kind: "package", id: archivedPackageId },
    { kind: "service", id: archivedServiceId },
  ] as const) {
    const result = await refreshCatalogEmbeddingsService({
      db: getDb(),
      owner,
    });
    assert.equal(result.embedded, 0);
    assert.equal((await knowledgeRows(owner)).length, 0);
  }
  assert.equal(gatewayCalls.length, 6);

  const packageRows = await knowledgeRows(packageOwner);
  assert.deepEqual(
    packageRows.map((row) => row.chunk_key).sort(),
    [
      "overview",
      `markdown:${packageMarkdownWidgetId}:0`,
      `photo:${sampleWidgetId}`,
      `photo:${uploadedWidgetId}`,
    ].sort(),
  );
  const overview = packageRows.find((row) => row.chunk_key === "overview");
  assert.doesNotMatch(overview?.content_markdown ?? "", /Active service/);
  assert.doesNotMatch(
    overview?.content_markdown ?? "",
    /Archived linked service/,
  );
  const sampleRow = packageRows.find((row) => row.media_id === sampleMediaId);
  assert.match(sampleRow?.content_markdown ?? "", /Section: Reception/);
  assert.match(
    sampleRow?.content_markdown ?? "",
    /Alt text: Sample garden arch/,
  );
  assert.match(
    sampleRow?.content_markdown ?? "",
    /Caption: Sample photo caption/,
  );
  const uploadedRow = packageRows.find(
    (row) => row.media_id === uploadedMediaId,
  );
  assert.match(
    uploadedRow?.content_markdown ?? "",
    /Alt text: Uploaded table setting/,
  );

  const sampleAsset = await getDb()
    .selectFrom("media_assets")
    .selectAll()
    .where("id", "=", sampleMediaId)
    .executeTakeFirstOrThrow();
  const expectedSampleImage = await readCatalogEmbeddingImage(
    sampleAsset as Selectable<MediaAssets>,
  );
  const sampleCall = gatewayCalls.find((call) =>
    call.body.values[0]?.includes("Sample garden arch"),
  );
  assert.ok(sampleCall);
  assert.equal(sampleCall.body.values[0]?.includes("Reception"), true);
  assert.equal(
    sampleCall.body.providerOptions?.google.content[0]?.[0]?.inlineData
      .mimeType,
    expectedSampleImage.mimeType,
  );
  assert.equal(
    sampleCall.body.providerOptions?.google.content[0]?.[0]?.inlineData.data,
    Buffer.from(expectedSampleImage.bytes).toString("base64"),
  );
  const uploadedCall = gatewayCalls.find((call) =>
    call.body.values[0]?.includes("Uploaded table setting"),
  );
  assert.ok(uploadedCall);
  assert.equal(
    uploadedCall.body.providerOptions?.google.content[0]?.[0]?.inlineData.data,
    Buffer.from(uploadedPhotoBytes).toString("base64"),
  );
  const textCall = gatewayCalls.find((call) =>
    call.body.values[0]?.includes("Markdown from the reception section"),
  );
  assert.ok(textCall);
  assert.equal(textCall.body.providerOptions, undefined);
  assert.equal(storageRequests, 1);

  const callsBeforeRepeat = gatewayCalls.length;
  const unchangedPackage = await refreshCatalogEmbeddingsService({
    db: getDb(),
    owner: packageOwner,
  });
  const unchangedService = await refreshCatalogEmbeddingsService({
    db: getDb(),
    owner: serviceOwner,
  });
  assert.equal(unchangedPackage.unchanged, 4);
  assert.equal(unchangedService.unchanged, 2);
  assert.equal(gatewayCalls.length, callsBeforeRepeat);
});

test("re-saving the same sample photo retains its embedding after media replacement", async () => {
  setGatewayHandler();
  const actorId = await createAdminId();
  const listing = await createPackageService(
    getDb(),
    packageContent("Stable sample package"),
    actorId,
  );
  assert.ok(!("status" in listing));
  await waitForCatalogEmbeddingRefresh(getDb());

  const originalSections = sectionsSchema.parse(listing.sections);
  const originalPhoto = originalSections
    .flatMap((section) => section.widgets)
    .find((widget) => widget.type === "photo");
  assert.ok(originalPhoto?.media?.id);
  const originalMediaId = originalPhoto.media.id;
  const originalPhotoWidgetId = originalPhoto.id;
  const originalSectionId = originalSections[0]?.id;
  assert.ok(originalSectionId);
  const owner = { kind: "package", id: listing.id } as const;
  const originalKnowledge = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === `photo:${originalPhotoWidgetId}`,
  );
  assert.ok(originalKnowledge?.embedding);
  assert.equal(originalKnowledge.media_id, originalMediaId);
  const previousGatewayCalls = gatewayCalls.length;

  const updated = await updatePackageService(
    getDb(),
    listing.id,
    {
      name: listing.name,
      description: listing.description,
      maxGuests: listing.maxGuests,
      price: listing.price,
      sections: originalSections,
      expectedUpdatedAt: listing.updatedAt,
    },
    actorId,
  );
  assert.ok(!("status" in updated));
  await waitForCatalogEmbeddingRefresh(getDb());

  const updatedSections = sectionsSchema.parse(updated.sections);
  assert.equal(updatedSections[0]?.id, originalSectionId);
  const updatedPhoto = updatedSections
    .flatMap((section) => section.widgets)
    .find((widget) => widget.id === originalPhotoWidgetId);
  assert.ok(updatedPhoto?.media?.id);
  assert.notEqual(updatedPhoto.media.id, originalMediaId);
  const updatedMedia = await getDb()
    .selectFrom("media_assets")
    .select("id")
    .where("id", "=", updatedPhoto.media.id)
    .executeTakeFirst();
  assert.ok(updatedMedia);
  const removedMedia = await getDb()
    .selectFrom("media_assets")
    .select("id")
    .where("id", "=", originalMediaId)
    .executeTakeFirst();
  assert.equal(removedMedia, undefined);

  const updatedKnowledge = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === `photo:${originalPhotoWidgetId}`,
  );
  assert.ok(updatedKnowledge?.embedding);
  assert.equal(updatedKnowledge.id, originalKnowledge.id);
  assert.equal(updatedKnowledge.media_id, updatedPhoto.media.id);
  assert.equal(updatedKnowledge.embedding_model, embeddingModel);
  assert.ok(updatedKnowledge.embedded_at);
  assert.equal(gatewayCalls.length, previousGatewayCalls);
});

test("content, photo context, embedding model, removal, and archive changes refresh the corpus", async () => {
  setGatewayHandler();
  const packageId = await createPackageRow({ name: "Refresh package" });
  const mediaId = await createMediaAsset("sample");
  const photoWidgetId = randomUUID();
  const markdownWidgetId = randomUUID();
  const owner = { kind: "package", id: packageId } as const;
  const canvas = (markdown: string, alt: string) => [
    section("Refresh section", [
      markdownWidget(markdownWidgetId, markdown),
      mediaWidget(photoWidgetId, mediaId, { alt }),
    ]),
  ];
  await setCanvas(owner, canvas("Original Markdown", "Original alt"));

  const first = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(first.embedded, 3);
  const baselineCalls = gatewayCalls.length;
  const rowsBeforeChange = await knowledgeRows(owner);

  await setCanvas(owner, canvas("Edited Markdown", "Edited alt"));
  const changed = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(changed.embedded, 2);
  assert.equal(changed.unchanged, 1);
  assert.equal(gatewayCalls.length, baselineCalls + 2);
  const rowsAfterChange = await knowledgeRows(owner);
  const markdown = rowsAfterChange.find(
    (row) => row.chunk_key === `markdown:${markdownWidgetId}:0`,
  );
  const photo = rowsAfterChange.find(
    (row) => row.chunk_key === `photo:${photoWidgetId}`,
  );
  assert.match(markdown?.content_markdown ?? "", /Edited Markdown/);
  assert.match(photo?.content_markdown ?? "", /Edited alt/);
  assert.ok(rowsBeforeChange.every((row) => row.embedding !== null));
  assert.ok(rowsAfterChange.every((row) => row.embedding !== null));

  const overview = rowsAfterChange.find((row) => row.chunk_key === "overview");
  assert.ok(overview);
  await getDb()
    .updateTable("catalog_knowledge")
    .set({ embedding_model: "google/previous-embedding-model" })
    .where("id", "=", overview.id)
    .execute();
  const modelChanged = await refreshCatalogEmbeddingsService({
    db: getDb(),
    owner,
  });
  assert.equal(modelChanged.embedded, 1);
  assert.equal(modelChanged.unchanged, 2);
  assert.equal(gatewayCalls.length, baselineCalls + 3);
  const refreshedOverview = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === "overview",
  );
  assert.equal(refreshedOverview?.embedding_model, embeddingModel);

  await setCanvas(owner, [
    section("Refresh section", [
      mediaWidget(photoWidgetId, mediaId, { alt: "Edited alt" }),
    ]),
  ]);
  await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.ok(
    !(await knowledgeRows(owner)).some(
      (row) => row.chunk_key === `markdown:${markdownWidgetId}:0`,
    ),
  );

  await getDb()
    .updateTable("packages")
    .set({ archived_at: new Date() })
    .where("id", "=", packageId)
    .execute();
  await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.deepEqual(await knowledgeRows(owner), []);
});

test("catalog create, update, and archive mutations refresh their owners", async () => {
  setGatewayHandler();
  const actorId = await createAdminId();

  const service = await createServiceService(
    getDb(),
    serviceContent("Catering service", "Buffet service details"),
    actorId,
  );
  assert.ok(!("status" in service));
  await waitForCatalogEmbeddingRefresh(getDb());
  const serviceOwner = { kind: "service", id: service.id } as const;
  assert.ok((await knowledgeRows(serviceOwner)).length > 0);

  const packageListing = await createPackageService(
    getDb(),
    packageContent("Garden package"),
    actorId,
  );
  assert.ok(!("status" in packageListing));
  await waitForCatalogEmbeddingRefresh(getDb());
  const packageOwner = { kind: "package", id: packageListing.id } as const;
  const initialPackageRows = await knowledgeRows(packageOwner);
  assert.ok(initialPackageRows.some((row) => row.chunk_key === "overview"));
  assert.ok(
    initialPackageRows.some((row) => row.chunk_key.startsWith("photo:")),
  );
  assert.ok(
    initialPackageRows.some((row) => row.chunk_key.startsWith("markdown:")),
  );

  const updatedPackage = await updatePackageService(
    getDb(),
    packageListing.id,
    {
      ...packageContent("Garden package revised", "Revised package details"),
      expectedUpdatedAt: packageListing.updatedAt,
    },
    actorId,
  );
  assert.ok(!("status" in updatedPackage));
  await waitForCatalogEmbeddingRefresh(getDb());
  const revisedPackageRows = await knowledgeRows(packageOwner);
  assert.match(
    revisedPackageRows.find((row) => row.chunk_key === "overview")
      ?.content_markdown ?? "",
    /Garden package revised/,
  );
  assert.ok(
    revisedPackageRows.some((row) =>
      row.content_markdown.includes("Revised package details"),
    ),
  );

  const updatedService = await updateServiceService(
    getDb(),
    service.id,
    {
      ...serviceContent("Catering service renamed", "Updated buffet details"),
      expectedUpdatedAt: service.updatedAt,
    },
    actorId,
  );
  assert.ok(!("status" in updatedService));
  await waitForCatalogEmbeddingRefresh(getDb());
  assert.match(
    (await knowledgeRows(serviceOwner)).find(
      (row) => row.chunk_key === "overview",
    )?.content_markdown ?? "",
    /Catering service renamed/,
  );
  assert.deepEqual(await knowledgeRows(packageOwner), revisedPackageRows);

  await archiveServiceService(getDb(), service.id);
  await waitForCatalogEmbeddingRefresh(getDb());
  assert.deepEqual(await knowledgeRows(serviceOwner), []);
  assert.deepEqual(await knowledgeRows(packageOwner), revisedPackageRows);

  await archivePackageService(getDb(), packageListing.id);
  await waitForCatalogEmbeddingRefresh(getDb());
  assert.deepEqual(await knowledgeRows(packageOwner), []);
});

test("service deletion removes its knowledge and an in-flight edit cannot save stale content", async () => {
  setGatewayHandler();
  const actorId = await createAdminId();
  const deletable = await createServiceService(
    getDb(),
    serviceContent("Deletable service"),
    actorId,
  );
  assert.ok(!("status" in deletable));
  await waitForCatalogEmbeddingRefresh(getDb());
  const deletableOwner = { kind: "service", id: deletable.id } as const;
  assert.ok((await knowledgeRows(deletableOwner)).length > 0);
  await deleteServiceService(getDb(), deletable.id);
  await waitForCatalogEmbeddingRefresh(getDb());
  assert.deepEqual(await knowledgeRows(deletableOwner), []);

  setGatewayHandler();
  const packageId = await createPackageRow({ name: "Concurrent package" });
  const owner = { kind: "package", id: packageId } as const;
  const started = new Promise<void>((resolve) => {
    gatewayHandler = async () => {
      resolve();
      await new Promise<void>((release) => {
        gatewayHandler = () => gatewayResponse();
        releaseGate = release;
      });
      return gatewayResponse();
    };
  });
  let releaseGate: (() => void) | undefined;
  await getDb()
    .updateTable("packages")
    .set({ description: "Before edit" })
    .where("id", "=", packageId)
    .execute();
  const originalRefresh = refreshCatalogEmbeddingsService({
    db: getDb(),
    owner,
  });
  await started;
  await getDb()
    .transaction()
    .execute(async (trx) => {
      await trx
        .updateTable("packages")
        .set({ description: "After edit" })
        .where("id", "=", packageId)
        .execute();
      await syncCatalogKnowledge(trx, owner);
    });
  assert.ok(releaseGate);
  releaseGate();
  const superseded = await originalRefresh;
  assert.equal(superseded.superseded, 1);
  const staleRow = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === "overview",
  );
  assert.ok(staleRow);
  assert.equal(staleRow.embedding, null);
  assert.match(staleRow.content_markdown, /After edit/);

  setGatewayHandler();
  const retry = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(retry.embedded, 1);
  const savedRow = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === "overview",
  );
  assert.ok(savedRow?.embedding);
  assert.match(savedRow?.content_markdown ?? "", /After edit/);
});

test("provider failures stay pending and a later refresh retries them", async () => {
  setGatewayHandler((call) => {
    assert.ok(call.body.values[0]?.includes("Retry package"));
    return new Response(
      JSON.stringify({ error: { message: "fixture failure" } }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  const packageId = await createPackageRow({ name: "Retry package" });
  const owner = { kind: "package", id: packageId } as const;
  const failed = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(failed.failed, 1);
  assert.equal(gatewayCalls.length, 1);
  const pending = (await knowledgeRows(owner))[0];
  assert.ok(pending);
  assert.equal(pending.embedding, null);
  assert.equal(pending.embedding_model, null);
  assert.equal(pending.embedded_at, null);

  setGatewayHandler();
  const retried = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(retried.embedded, 1);
  assert.equal(gatewayCalls.length, 1);
  const completed = (await knowledgeRows(owner))[0];
  assert.ok(completed?.embedding);
  assert.equal(completed?.embedding_model, embeddingModel);
});

test("automatic save stays successful with missing embedding config and manual refresh recovers", async () => {
  const previousApiKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  setGatewayHandler();

  try {
    const actorId = await createAdminId();
    const listing = await createPackageService(
      getDb(),
      packageContent("Pending config package"),
      actorId,
    );
    assert.ok(!("status" in listing));
    await waitForCatalogEmbeddingRefresh(getDb());

    const owner = { kind: "package", id: listing.id } as const;
    const pendingRows = await knowledgeRows(owner);
    assert.equal(pendingRows.length, 3);
    assert.ok(
      pendingRows.every(
        (row) =>
          row.embedding === null &&
          row.embedding_model === null &&
          row.embedded_at === null,
      ),
    );
    assert.equal(gatewayCalls.length, 0);

    process.env.AI_GATEWAY_API_KEY = "fixture-gateway-key";
    const recovered = await refreshCatalogEmbeddingsService({
      db: getDb(),
      owner,
    });
    assert.equal(recovered.embedded, 3);
    assert.equal(gatewayCalls.length, 3);
    const completedRows = await knowledgeRows(owner);
    assert.ok(
      completedRows.every(
        (row) =>
          row.embedding !== null &&
          row.embedding_model === embeddingModel &&
          row.embedded_at !== null,
      ),
    );
  } finally {
    if (previousApiKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousApiKey;
  }
});

test("await mode completes catalog embeddings before save returns and contains provider failure", async () => {
  const previousAwaitMode = process.env.CATALOG_EMBEDDING_AWAIT;
  process.env.CATALOG_EMBEDDING_AWAIT = "true";

  try {
    const actorId = await createAdminId();
    setGatewayHandler();
    const packageListing = await createPackageService(
      getDb(),
      packageContent("Awaited package"),
      actorId,
    );
    assert.ok(!("status" in packageListing));
    const packageOwner = {
      kind: "package",
      id: packageListing.id,
    } as const;
    const packageRows = await knowledgeRows(packageOwner);
    assert.equal(packageRows.length, 3);
    assert.ok(
      packageRows.every(
        (row) =>
          row.embedding !== null &&
          row.embedding_model === embeddingModel &&
          row.embedded_at !== null,
      ),
    );
    assert.equal(gatewayCalls.length, 3);

    setGatewayHandler(
      () =>
        new Response(
          JSON.stringify({ error: { message: "fixture failure" } }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    const serviceListing = await createServiceService(
      getDb(),
      serviceContent("Awaited service"),
      actorId,
    );
    assert.ok(!("status" in serviceListing));
    const serviceOwner = {
      kind: "service",
      id: serviceListing.id,
    } as const;
    const serviceRows = await knowledgeRows(serviceOwner);
    assert.equal(serviceRows.length, 3);
    assert.ok(
      serviceRows.every(
        (row) =>
          row.embedding === null &&
          row.embedding_model === null &&
          row.embedded_at === null,
      ),
    );
    assert.equal(gatewayCalls.length, 3);
  } finally {
    if (previousAwaitMode === undefined)
      delete process.env.CATALOG_EMBEDDING_AWAIT;
    else process.env.CATALOG_EMBEDDING_AWAIT = previousAwaitMode;
  }
});
