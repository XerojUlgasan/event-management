import "dotenv/config";
import { setTestConfig } from "../helpers/set-test-config.js";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, afterEach, before, test } from "node:test";
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
import { runOneBackgroundJob } from "../../src/services/background-jobs/run-one-background-job.js";
import { claimJobData } from "../../src/data/background-jobs/claim-job.js";
import { finishJobData } from "../../src/data/background-jobs/finish-job.js";
import { readCatalogEmbeddingImage } from "../../src/services/ai/retrieval/read-catalog-embedding-image.js";
import { loadCatalogKnowledge } from "../../src/services/ai/load-catalog-knowledge.js";
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
  "STORAGE_BUCKET",
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

async function drainCatalogJobs(database: Kysely<DB>) {
  const signal = AbortSignal.timeout(30_000);

  while (await runOneBackgroundJob(database, { signal })) {
    signal.throwIfAborted();
  }
}

afterEach(async () => {
  // Each case owns its queue; delayed retries must not leak into later cases.
  if (db) await db.deleteFrom("background_jobs").execute();
});

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
  setTestConfig({ SUPABASE_URL: `http://127.0.0.1:${address.port}` });
  setTestConfig({
    SUPABASE_SERVICE_ROLE_KEY: "fixture-storage-key",
    STORAGE_BUCKET: "event-management",
    AI_GATEWAY_API_KEY: "fixture-gateway-key",
    EMBEDDING_MODEL: embeddingModel,
  });
  await installGatewayInterceptor();
});

after(async () => {
  if (db) await drainCatalogJobs(db).catch(() => {});

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

    setTestConfig({ [name]: value });
  }
});

test("manual replay preserves a failing owner job and its backoff", async () => {
  const id = await createServiceRow({ name: "Manual retry isolation" });
  setGatewayHandler(
    () =>
      new Response(JSON.stringify({ error: { message: "fixture failure" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
  );

  try {
    assert.deepEqual(
      await indexPendingCatalogKnowledgeService(
        getDb(),
        AbortSignal.timeout(30_000),
      ),
      {
        pendingListings: 1,
        submittedListings: 1,
        skippedListings: 0,
        failedListings: 0,
      },
    );

    for (let attempt = 1; attempt <= 2; attempt++) {
      await drainCatalogJobs(getDb());
      const before = await getDb()
        .selectFrom("background_jobs")
        .selectAll()
        .where("dedupe_key", "=", id)
        .executeTakeFirstOrThrow();
      assert.equal(before.status, "pending");
      assert.equal(before.attempts, attempt);
      assert.ok(new Date(before.available_at).getTime() > Date.now());
      assert.deepEqual(
        await indexPendingCatalogKnowledgeService(
          getDb(),
          AbortSignal.timeout(30_000),
        ),
        {
          pendingListings: 1,
          submittedListings: 0,
          skippedListings: 1,
          failedListings: 0,
        },
      );
      const rows = await getDb()
        .selectFrom("background_jobs")
        .selectAll()
        .where("dedupe_key", "=", id)
        .execute();
      assert.deepEqual(rows, [before]);

      if (attempt === 1)
        await getDb()
          .updateTable("background_jobs")
          .set({ available_at: new Date(0) })
          .where("id", "=", before.id)
          .execute();
    }

    await getDb()
      .updateTable("background_jobs")
      .set({ available_at: new Date(0) })
      .where("dedupe_key", "=", id)
      .execute();
    const policies = { embed_service: [10_000, 60_000, 300_000] };
    const job = await claimJobData(getDb(), 60_000, policies);
    assert.ok(job);
    assert.equal(
      await finishJobData(getDb(), job, "permanent", policies),
      true,
    );
    assert.deepEqual(
      await indexPendingCatalogKnowledgeService(
        getDb(),
        AbortSignal.timeout(30_000),
      ),
      {
        pendingListings: 1,
        submittedListings: 1,
        skippedListings: 0,
        failedListings: 0,
      },
    );
    assert.deepEqual(
      (
        await getDb()
          .selectFrom("background_jobs")
          .select("status")
          .where("dedupe_key", "=", id)
          .execute()
      )
        .map((row) => row.status)
        .sort(),
      ["failed", "pending"],
    );
  } finally {
    await getDb().deleteFrom("services").where("id", "=", id).execute();
    setGatewayHandler();
  }
});

test("admin submits all pending owners without provider configuration and workers index text and photos", async () => {
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
  assert.equal((await request({ cursor: "old" }, admin)).status, 400);
  const empty = await request({}, admin);
  assert.equal(empty.status, 202);
  assert.deepEqual(await empty.json(), {
    pendingListings: 0,
    submittedListings: 0,
    skippedListings: 0,
    failedListings: 0,
  });
  const brokenDiscovery = await createServiceRow({ name: "Discovery failure" });
  await sql`alter table catalog_knowledge rename to fixture_hidden_knowledge`.execute(
    getDb(),
  );

  try {
    const unavailable = await request({}, admin);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), {
      error: "Knowledge indexing is temporarily unavailable",
    });
  } finally {
    await sql`alter table fixture_hidden_knowledge rename to catalog_knowledge`.execute(
      getDb(),
    );
    await getDb()
      .deleteFrom("services")
      .where("id", "=", brokenDiscovery)
      .execute();
  }

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
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  setTestConfig({
    AI_GATEWAY_API_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  });
  setGatewayHandler();
  storageRequests = 0;

  try {
    const response = await request({}, admin);
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      pendingListings: 2,
      submittedListings: 2,
      skippedListings: 0,
      failedListings: 0,
    });
    assert.equal(gatewayCalls.length, 0);
    assert.equal(storageRequests, 0);
    assert.equal(
      (await getDb().selectFrom("background_jobs").select("id").execute())
        .length,
      2,
    );
    const replay = await request({}, admin);
    assert.deepEqual(await replay.json(), {
      pendingListings: 2,
      submittedListings: 0,
      skippedListings: 2,
      failedListings: 0,
    });
    assert.equal(
      (await getDb().selectFrom("background_jobs").select("id").execute())
        .length,
      2,
    );
    setTestConfig({
      AI_GATEWAY_API_KEY: apiKey,
      SUPABASE_SERVICE_ROLE_KEY: storageKey,
    });

    let releaseProvider = () => {};

    let providerStarted = () => {};

    const started = new Promise<void>((resolve) => {
      providerStarted = resolve;
    });

    const release = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });

    setGatewayHandler(async () => {
      providerStarted();
      await release;

      return gatewayResponse();
    });
    const worker = runOneBackgroundJob(getDb(), {
      signal: AbortSignal.timeout(30_000),
    });
    await started;

    try {
      const during = await request({}, admin);
      assert.deepEqual(await during.json(), {
        pendingListings: 2,
        submittedListings: 0,
        skippedListings: 2,
        failedListings: 0,
      });
      assert.equal(
        (await getDb().selectFrom("background_jobs").select("id").execute())
          .length,
        2,
      );
    } finally {
      releaseProvider();
      await worker;
    }

    await drainCatalogJobs(getDb());
    assert.equal(
      (await knowledgeRows({ kind: "service", id: first })).length,
      2,
    );
    assert.equal(
      (await knowledgeRows({ kind: "service", id: archived })).length,
      0,
    );
    assert.equal(gatewayCalls.length, 3);
    assert.equal(storageRequests, 1);
    const search = await searchCatalogKnowledgeService(getDb(), "fixture");
    assert.ok(search.results.some((item) => item.listing.id === first));
    const done = await request({}, admin);
    assert.deepEqual(await done.json(), {
      pendingListings: 0,
      submittedListings: 0,
      skippedListings: 0,
      failedListings: 0,
    });
  } finally {
    setTestConfig({ AI_GATEWAY_API_KEY: apiKey });

    setTestConfig({ SUPABASE_SERVICE_ROLE_KEY: storageKey });

    await getDb()
      .deleteFrom("services")
      .where("id", "in", [first, second, archived])
      .execute();
    setGatewayHandler();
    storageRequests = 0;
  }
});

test("discovery submits a large catalog and recovers after an owner transaction fails", async () => {
  const ids = Array.from({ length: 250 }, () => randomUUID()).sort();

  await getDb()
    .insertInto("services")
    .values(
      ids.map((id) => ({
        id,
        name: `Fixture ${id}`,
        slug: `fixture-${id}`,
        description: "Fixture",
        hourly_rate_pesos: 1,
      })),
    )
    .execute();
  const failedId = ids[1]!;
  await sql`create function fixture_fail_job() returns trigger language plpgsql as $$
    begin if new.dedupe_key = '${sql.raw(failedId)}' then raise exception 'synthetic failure'; end if; return new; end $$`.execute(
    getDb(),
  );
  await sql`create trigger fixture_fail_job before insert on background_jobs for each row execute function fixture_fail_job()`.execute(
    getDb(),
  );

  try {
    setGatewayHandler();
    const start = Date.now();
    const result = await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    const duration = Date.now() - start;
    assert.deepEqual(result, {
      pendingListings: 250,
      submittedListings: 249,
      skippedListings: 0,
      failedListings: 1,
    });
    assert.ok(duration < 75_000, `250 owners took ${duration}ms`);
    assert.equal(gatewayCalls.length, 0);
    assert.equal(
      (await getDb().selectFrom("background_jobs").select("id").execute())
        .length,
      249,
    );
    await sql`drop trigger fixture_fail_job on background_jobs`.execute(
      getDb(),
    );
    const retry = await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    assert.equal(retry.submittedListings, 1);
    assert.equal(retry.skippedListings, 249);
    assert.equal(
      (await getDb().selectFrom("background_jobs").select("id").execute())
        .length,
      250,
    );
    console.log(`Submitted 250 fixture listings in ${duration}ms`);
  } finally {
    await sql`drop trigger if exists fixture_fail_job on background_jobs`.execute(
      getDb(),
    );
    await sql`drop function if exists fixture_fail_job()`.execute(getDb());
    await getDb().deleteFrom("services").where("id", "in", ids).execute();
  }
});

test("discovery selects missing, partial, stale, and withdrawn owners and skips current and ineligible owners", async () => {
  const current = await createServiceRow({ name: "Discovery current" });
  const partial = await createServiceRow({ name: "Discovery partial" });
  const stale = await createServiceRow({ name: "Discovery stale" });
  const withdrawn = await createServiceRow({ name: "Discovery withdrawn" });
  const missing = await createServiceRow({ name: "Discovery missing" });
  const archived = await createServiceRow({
    name: "Discovery archived",
    archived: true,
  });
  const pkg = await createPackageRow({ name: "Discovery package" });
  const archivedPkg = await createPackageRow({
    name: "Discovery archived package",
    archived: true,
  });
  const custom = await createCustomPackageRow("Discovery custom");
  await setCanvas({ kind: "service", id: withdrawn }, [
    section("Removed", [markdownWidget(randomUUID(), "Removed")]),
  ]);

  for (const id of [current, partial, stale, withdrawn]) {
    await refreshCatalogEmbeddingsService({
      db: getDb(),
      owner: { kind: "service", id },
    });
  }

  await setCanvas({ kind: "service", id: partial }, [
    section("New", [markdownWidget(randomUUID(), "New")]),
  ]);
  await setCanvas({ kind: "service", id: withdrawn }, []);
  await getDb()
    .updateTable("catalog_knowledge")
    .set({ embedding_model: "old-model" })
    .where("service_id", "=", stale)
    .execute();
  setGatewayHandler();

  try {
    await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    const jobs = await getDb()
      .selectFrom("background_jobs")
      .select(["type", "dedupe_key"])
      .execute();

    const keys = new Set(jobs.map((job) => `${job.type}:${job.dedupe_key}`));

    for (const id of [partial, stale, withdrawn, missing])
      assert.ok(keys.has(`embed_service:${id}`));

    assert.ok(keys.has(`embed_package:${pkg}`));

    for (const id of [current, archived])
      assert.ok(!keys.has(`embed_service:${id}`));

    for (const id of [custom, archivedPkg])
      assert.ok(!keys.has(`embed_package:${id}`));

    assert.equal(gatewayCalls.length, 0);
  } finally {
    await getDb()
      .deleteFrom("services")
      .where("id", "in", [
        current,
        partial,
        stale,
        withdrawn,
        missing,
        archived,
      ])
      .execute();
    await getDb()
      .deleteFrom("packages")
      .where("id", "in", [pkg, archivedPkg])
      .execute();
    await getDb().deleteFrom("catalog_knowledge").execute();
    await getDb().deleteFrom("background_jobs").execute();
    await getDb().deleteFrom("packages").where("id", "=", custom).execute();
    await getDb().deleteFrom("booking_requests").execute();
    await getDb().deleteFrom("packages").execute();
  }
});

test("cancellation rolls back the active submission and preserves its committed prefix", async () => {
  const ids = Array.from({ length: 3 }, () => randomUUID()).sort();

  await getDb()
    .insertInto("services")
    .values(
      ids.map((id) => ({
        id,
        name: `Cancel ${id}`,
        slug: `cancel-${id}`,
        description: "Fixture",
        hourly_rate_pesos: 1,
      })),
    )
    .execute();
  await sql`create function fixture_slow_job() returns trigger language plpgsql as $$
    begin if new.dedupe_key = '${sql.raw(ids[1]!)}' then perform pg_advisory_xact_lock(51293876); end if; return new; end $$`.execute(
    getDb(),
  );
  await sql`create trigger fixture_slow_job before insert on background_jobs for each row execute function fixture_slow_job()`.execute(
    getDb(),
  );

  let release = () => {};

  let ready = () => {};

  const locked = new Promise<void>((resolve) => {
    ready = resolve;
  });

  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  const holder = getDb()
    .transaction()
    .execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(51293876)`.execute(trx);
      ready();
      await released;
    });

  await locked;

  try {
    const controller = new AbortController();
    const pending = indexPendingCatalogKnowledgeService(
      getDb(),
      controller.signal,
    );
    const deadline = Date.now() + 5000;

    while (
      !(await getDb()
        .selectFrom("background_jobs")
        .select("id")
        .where("dedupe_key", "=", ids[0]!)
        .executeTakeFirst())
    ) {
      if (Date.now() > deadline)
        throw new Error("First submission did not commit");

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    while (
      !(
        await sql<{
          waiting: boolean;
        }>`select exists(select 1 from pg_locks where locktype = 'advisory' and objid = 51293876 and not granted) as waiting`.execute(
          getDb(),
        )
      ).rows[0]?.waiting
    ) {
      if (Date.now() > deadline)
        throw new Error("Second submission did not enter the transaction");

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    controller.abort();
    release();
    await holder;
    await assert.rejects(pending);
    const jobs = await getDb()
      .selectFrom("background_jobs")
      .select("dedupe_key")
      .execute();
    assert.deepEqual(
      jobs.map((job) => job.dedupe_key),
      [ids[0]],
    );
    await sql`drop trigger fixture_slow_job on background_jobs`.execute(
      getDb(),
    );
    const retry = await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    assert.deepEqual(retry, {
      pendingListings: 3,
      submittedListings: 2,
      skippedListings: 1,
      failedListings: 0,
    });
    assert.equal(
      (await getDb().selectFrom("background_jobs").select("id").execute())
        .length,
      3,
    );
  } finally {
    release();
    await holder;
    await sql`drop trigger if exists fixture_slow_job on background_jobs`.execute(
      getDb(),
    );
    await sql`drop function if exists fixture_slow_job()`.execute(getDb());
    await getDb().deleteFrom("services").where("id", "in", ids).execute();
  }
});

test("repeated manual submission leaves a running owner alone", async () => {
  const id = await createServiceRow({ name: "Running successor" });

  try {
    await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    assert.ok(
      await claimJobData(getDb(), 60_000, {
        embed_service: [10_000, 60_000, 300_000],
      }),
    );
    await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(75_000),
    );
    const jobs = await getDb()
      .selectFrom("background_jobs")
      .select("status")
      .where("dedupe_key", "=", id)
      .execute();
    assert.deepEqual(
      jobs.map((job) => job.status),
      ["running"],
    );
  } finally {
    await getDb().deleteFrom("services").where("id", "=", id).execute();
  }
});

test("simultaneous manual passes schedule each owner once", async () => {
  const id = await createServiceRow({ name: "Concurrent manual passes" });

  try {
    const results = await Promise.all([
      indexPendingCatalogKnowledgeService(getDb(), AbortSignal.timeout(30_000)),
      indexPendingCatalogKnowledgeService(getDb(), AbortSignal.timeout(30_000)),
    ]);
    assert.deepEqual(
      results.map((result) => result.submittedListings).sort(),
      [0, 1],
    );
    assert.equal(
      results.reduce((total, result) => total + result.skippedListings, 0),
      1,
    );
    assert.equal(
      (
        await getDb()
          .selectFrom("background_jobs")
          .select("id")
          .where("dedupe_key", "=", id)
          .execute()
      ).length,
      1,
    );
  } finally {
    await getDb().deleteFrom("services").where("id", "=", id).execute();
  }
});

test("a real catalog edit while a job runs still schedules its successor", async () => {
  const actorId = await createAdminId();
  const service = await createServiceService(
    getDb(),
    serviceContent("Running edit"),
    actorId,
  );
  assert.ok(!("status" in service));

  let releaseProvider = () => {};

  let providerStarted = () => {};

  const started = new Promise<void>((resolve) => {
    providerStarted = resolve;
  });

  const release = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });

  setGatewayHandler(async () => {
    providerStarted();
    await release;

    return gatewayResponse();
  });
  const worker = runOneBackgroundJob(getDb(), {
    signal: AbortSignal.timeout(30_000),
  });

  try {
    await started;
    const updated = await updateServiceService(
      getDb(),
      service.id,
      {
        ...serviceContent("Running edit revised"),
        expectedUpdatedAt: service.updatedAt,
      },
      actorId,
    );
    assert.ok(!("status" in updated));
    const result = await indexPendingCatalogKnowledgeService(
      getDb(),
      AbortSignal.timeout(30_000),
    );
    assert.equal(result.skippedListings, 1);
    assert.deepEqual(
      (
        await getDb()
          .selectFrom("background_jobs")
          .select("status")
          .where("dedupe_key", "=", service.id)
          .execute()
      )
        .map((row) => row.status)
        .sort(),
      ["pending", "running"],
    );
    releaseProvider();
    await worker;
    await drainCatalogJobs(getDb());
    assert.deepEqual(
      (
        await getDb()
          .selectFrom("background_jobs")
          .select("status")
          .where("dedupe_key", "=", service.id)
          .execute()
      ).map((row) => row.status),
      ["completed", "completed"],
    );
    const knowledge = await loadCatalogKnowledge(getDb(), {
      kind: "service",
      id: service.id,
    });
    assert.equal(knowledge.entries[0]?.listing.status, "indexed");
    assert.match(
      (await knowledgeRows({ kind: "service", id: service.id })).find(
        (row) => row.chunk_key === "text",
      )?.content_markdown ?? "",
      /Running edit revised/,
    );
    assert.ok(
      gatewayCalls.some((call) =>
        call.body.values.some((value) =>
          value.includes("Running edit revised"),
        ),
      ),
    );
  } finally {
    releaseProvider();
    await worker;
    await getDb().deleteFrom("services").where("id", "=", service.id).execute();
    setGatewayHandler();
  }
});

test("owner is reassessed after waiting for indexing, archival, or deletion", async () => {
  for (const change of ["indexed", "archived", "deleted"] as const) {
    const id = await createServiceRow({ name: `Reassess ${change}` });

    if (change === "indexed") {
      await refreshCatalogEmbeddingsService({
        db: getDb(),
        owner: { kind: "service", id },
      });
      await getDb()
        .updateTable("catalog_knowledge")
        .set({ embedding_model: "old-model" })
        .where("service_id", "=", id)
        .execute();
    }

    let release = () => {};

    let ready = () => {};

    const locked = new Promise<void>((resolve) => {
      ready = resolve;
    });

    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holder = getDb()
      .transaction()
      .execute(async (trx) => {
        await trx
          .selectFrom("services")
          .select("id")
          .where("id", "=", id)
          .forUpdate()
          .execute();

        if (change === "indexed")
          await trx
            .updateTable("catalog_knowledge")
            .set({ embedding_model: embeddingModel })
            .where("service_id", "=", id)
            .execute();
        else if (change === "archived")
          await trx
            .updateTable("services")
            .set({ archived_at: new Date() })
            .where("id", "=", id)
            .execute();
        else await trx.deleteFrom("services").where("id", "=", id).execute();

        ready();
        await released;
      });

    await locked;

    try {
      const pending = indexPendingCatalogKnowledgeService(
        getDb(),
        AbortSignal.timeout(30_000),
      );
      const deadline = Date.now() + 4000;

      while (
        !(
          await sql<{
            waiting: boolean;
          }>`select exists(select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%for update%') as waiting`.execute(
            getDb(),
          )
        ).rows[0]?.waiting
      ) {
        if (Date.now() > deadline)
          throw new Error("Manual pass did not wait for owner lock");

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      release();
      await holder;
      assert.deepEqual(await pending, {
        pendingListings: 1,
        submittedListings: 0,
        skippedListings: 1,
        failedListings: 0,
      });
      assert.equal(
        (
          await getDb()
            .selectFrom("background_jobs")
            .select("id")
            .where("dedupe_key", "=", id)
            .execute()
        ).length,
        0,
      );
    } finally {
      release();
      await holder;
      await getDb().deleteFrom("services").where("id", "=", id).execute();
    }
  }
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
  assert.equal(packageResult.embedded, 3);
  assert.equal(serviceResult.embedded, 1);
  assert.equal(gatewayCalls.length, 4);

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

  assert.equal(gatewayCalls.length, 4);

  const packageRows = await knowledgeRows(packageOwner);
  assert.deepEqual(
    packageRows.map((row) => row.chunk_key).sort(),
    ["text", `photo:${sampleWidgetId}`, `photo:${uploadedWidgetId}`].sort(),
  );

  const overview = packageRows.find((row) => row.chunk_key === "text");

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
  assert.equal(unchangedPackage.unchanged, 3);
  assert.equal(unchangedService.unchanged, 1);
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
  await drainCatalogJobs(getDb());

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
  assert.equal(
    gatewayCalls.length,
    previousGatewayCalls,
    "updates defer provider work",
  );
  await drainCatalogJobs(getDb());

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

test("legacy text rows are withdrawn until sync replaces them and preserves photo embeddings", async () => {
  setGatewayHandler();
  const packageId = await createPackageRow({ name: "Legacy package" });
  const mediaId = await createMediaAsset("sample");
  const photoId = randomUUID();
  const owner = { kind: "package", id: packageId } as const;
  await setCanvas(owner, [
    section("Details", [
      markdownWidget(randomUUID(), "Current details"),
      mediaWidget(photoId, mediaId, { alt: "Unchanged photo" }),
    ]),
  ]);
  await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  const initial = await knowledgeRows(owner);

  const originalText = initial.find((row) => row.chunk_key === "text");

  const originalPhoto = initial.find(
    (row) => row.chunk_key === `photo:${photoId}`,
  );

  assert.ok(originalText && originalPhoto?.embedding);
  await getDb()
    .updateTable("catalog_knowledge")
    .set({ chunk_key: "overview" })
    .where("id", "=", originalText.id)
    .execute();
  const legacyKeys = [
    "overview",
    "overview:1",
    "markdown:old:0",
    "service:old",
    "package:old",
  ];

  for (const key of legacyKeys.slice(1)) {
    await getDb()
      .insertInto("catalog_knowledge")
      .values({
        package_id: packageId,
        service_id: null,
        chunk_key: key,
        content_markdown: "Legacy text",
        content_hash: "legacy",
        media_id: null,
        embedding: null,
        embedding_model: null,
        embedded_at: null,
      })
      .execute();
  }

  const before = (await loadCatalogKnowledge(getDb(), owner)).entries[0];
  assert.equal(before?.listing.status, "needs-refresh");
  assert.equal(
    before?.chunks.find((chunk) => chunk.key === "text")?.status,
    "pending",
  );

  for (const key of legacyKeys)
    assert.equal(
      before?.chunks.find((chunk) => chunk.key === key)?.withdrawn,
      true,
    );

  const result = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(result.embedded, 1);
  assert.equal(result.unchanged, 1);
  const after = await knowledgeRows(owner);
  assert.deepEqual(
    after.map((row) => row.chunk_key).sort(),
    ["text", `photo:${photoId}`].sort(),
  );

  const retained = after.find((row) => row.chunk_key === `photo:${photoId}`);

  assert.equal(retained?.id, originalPhoto.id);
  assert.equal(retained?.content_hash, originalPhoto.content_hash);
  assert.deepEqual(retained?.embedding, originalPhoto.embedding);
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
  assert.equal(first.embedded, 2);
  const baselineCalls = gatewayCalls.length;
  const rowsBeforeChange = await knowledgeRows(owner);

  await setCanvas(owner, canvas("Edited Markdown", "Original alt"));
  const textOnly = await refreshCatalogEmbeddingsService({
    db: getDb(),
    owner,
  });
  assert.equal(textOnly.embedded, 1);
  assert.equal(textOnly.unchanged, 1);
  const textOnlyRows = await knowledgeRows(owner);

  const photoBefore = rowsBeforeChange.find(
    (row) => row.chunk_key === `photo:${photoWidgetId}`,
  );

  const photoAfter = textOnlyRows.find(
    (row) => row.chunk_key === `photo:${photoWidgetId}`,
  );

  assert.equal(photoAfter?.id, photoBefore?.id);
  assert.deepEqual(photoAfter?.embedding, photoBefore?.embedding);

  await setCanvas(owner, canvas("Edited Markdown", "Edited alt"));
  const changed = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(changed.embedded, 1);
  assert.equal(changed.unchanged, 1);
  assert.equal(gatewayCalls.length, baselineCalls + 2);
  const rowsAfterChange = await knowledgeRows(owner);

  const markdown = rowsAfterChange.find((row) => row.chunk_key === "text");

  const photo = rowsAfterChange.find(
    (row) => row.chunk_key === `photo:${photoWidgetId}`,
  );

  assert.match(markdown?.content_markdown ?? "", /Edited Markdown/);
  assert.match(photo?.content_markdown ?? "", /Edited alt/);
  assert.ok(rowsBeforeChange.every((row) => row.embedding !== null));
  assert.ok(rowsAfterChange.every((row) => row.embedding !== null));

  const overview = rowsAfterChange.find((row) => row.chunk_key === "text");

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
  assert.equal(modelChanged.unchanged, 1);
  assert.equal(gatewayCalls.length, baselineCalls + 3);

  const refreshedOverview = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === "text",
  );

  assert.equal(refreshedOverview?.embedding_model, embeddingModel);

  await setCanvas(owner, [
    section("Refresh section", [
      mediaWidget(photoWidgetId, mediaId, { alt: "Edited alt" }),
    ]),
  ]);
  await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.doesNotMatch(
    (await knowledgeRows(owner)).find((row) => row.chunk_key === "text")
      ?.content_markdown ?? "",
    /Edited Markdown/,
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
  await drainCatalogJobs(getDb());
  const serviceOwner = { kind: "service", id: service.id } as const;
  assert.ok((await knowledgeRows(serviceOwner)).length > 0);

  const packageListing = await createPackageService(
    getDb(),
    packageContent("Garden package"),
    actorId,
  );
  assert.ok(!("status" in packageListing));
  await drainCatalogJobs(getDb());
  const packageOwner = { kind: "package", id: packageListing.id } as const;
  const initialPackageRows = await knowledgeRows(packageOwner);
  assert.ok(initialPackageRows.some((row) => row.chunk_key === "text"));
  assert.ok(
    initialPackageRows.some((row) => row.chunk_key.startsWith("photo:")),
  );
  assert.match(
    initialPackageRows.find((row) => row.chunk_key === "text")
      ?.content_markdown ?? "",
    /Garden package/,
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
  await drainCatalogJobs(getDb());
  const revisedPackageRows = await knowledgeRows(packageOwner);
  assert.match(
    revisedPackageRows.find((row) => row.chunk_key === "text")
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
  await drainCatalogJobs(getDb());
  assert.match(
    (await knowledgeRows(serviceOwner)).find((row) => row.chunk_key === "text")
      ?.content_markdown ?? "",
    /Catering service renamed/,
  );
  assert.deepEqual(await knowledgeRows(packageOwner), revisedPackageRows);

  await archiveServiceService(getDb(), service.id);
  await drainCatalogJobs(getDb());
  assert.deepEqual(await knowledgeRows(serviceOwner), []);
  assert.deepEqual(await knowledgeRows(packageOwner), revisedPackageRows);

  await archivePackageService(getDb(), packageListing.id);
  await drainCatalogJobs(getDb());
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
  await drainCatalogJobs(getDb());
  const deletableOwner = { kind: "service", id: deletable.id } as const;
  assert.ok((await knowledgeRows(deletableOwner)).length > 0);
  await deleteServiceService(getDb(), deletable.id);
  await drainCatalogJobs(getDb());
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
    (row) => row.chunk_key === "text",
  );

  assert.ok(staleRow);
  assert.equal(staleRow.embedding, null);
  assert.match(staleRow.content_markdown, /After edit/);

  setGatewayHandler();
  const retry = await refreshCatalogEmbeddingsService({ db: getDb(), owner });
  assert.equal(retry.embedded, 1);

  const savedRow = (await knowledgeRows(owner)).find(
    (row) => row.chunk_key === "text",
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
  setTestConfig({ AI_GATEWAY_API_KEY: undefined });
  setGatewayHandler();

  try {
    const actorId = await createAdminId();
    const listing = await createPackageService(
      getDb(),
      packageContent("Pending config package"),
      actorId,
    );
    assert.ok(!("status" in listing));
    await drainCatalogJobs(getDb());

    const owner = { kind: "package", id: listing.id } as const;
    const pendingRows = await knowledgeRows(owner);
    assert.equal(pendingRows.length, 2);
    assert.ok(
      pendingRows.every(
        (row) =>
          row.embedding === null &&
          row.embedding_model === null &&
          row.embedded_at === null,
      ),
    );
    assert.equal(gatewayCalls.length, 0);

    setTestConfig({ AI_GATEWAY_API_KEY: "fixture-gateway-key" });
    const recovered = await refreshCatalogEmbeddingsService({
      db: getDb(),
      owner,
    });
    assert.equal(recovered.embedded, 2);
    assert.equal(gatewayCalls.length, 2);
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
    setTestConfig({ AI_GATEWAY_API_KEY: previousApiKey });
  }
});

test("package and service creates and updates roll back when enqueue fails", async () => {
  const actorId = await createAdminId();
  setGatewayHandler();
  const existingPackage = await createPackageService(
    getDb(),
    packageContent("Atomic package"),
    actorId,
  );
  const existingService = await createServiceService(
    getDb(),
    serviceContent("Atomic service"),
    actorId,
  );
  assert.ok(!("status" in existingPackage));
  assert.ok(!("status" in existingService));

  const snapshot = () =>
    Promise.all([
      getDb().selectFrom("packages").selectAll().orderBy("id").execute(),
      getDb().selectFrom("services").selectAll().orderBy("id").execute(),
      getDb().selectFrom("media_assets").selectAll().orderBy("id").execute(),
      getDb()
        .selectFrom("catalog_knowledge")
        .selectAll()
        .orderBy("id")
        .execute(),
      getDb().selectFrom("background_jobs").selectAll().orderBy("id").execute(),
    ]);

  const before = await snapshot();
  await sql`CREATE FUNCTION public.reject_fixture_background_job() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture enqueue unavailable'; END;
  $$`.execute(getDb());
  await sql`CREATE TRIGGER reject_fixture_background_job BEFORE INSERT ON public.background_jobs
    FOR EACH ROW EXECUTE FUNCTION public.reject_fixture_background_job()`.execute(
    getDb(),
  );

  try {
    await assert.rejects(
      createPackageService(
        getDb(),
        packageContent("Rolled back package create"),
        actorId,
      ),
      /fixture enqueue unavailable/,
    );
    await assert.rejects(
      createServiceService(
        getDb(),
        serviceContent("Rolled back service create"),
        actorId,
      ),
      /fixture enqueue unavailable/,
    );
    await assert.rejects(
      updatePackageService(
        getDb(),
        existingPackage.id,
        {
          ...packageContent("Rolled back package update"),
          expectedUpdatedAt: existingPackage.updatedAt,
        },
        actorId,
      ),
      /fixture enqueue unavailable/,
    );
    await assert.rejects(
      updateServiceService(
        getDb(),
        existingService.id,
        {
          ...serviceContent("Rolled back service update"),
          expectedUpdatedAt: existingService.updatedAt,
        },
        actorId,
      ),
      /fixture enqueue unavailable/,
    );
    assert.deepEqual(
      await snapshot(),
      before,
      "listing, canvas, media, knowledge and jobs must commit together",
    );
    assert.equal(gatewayCalls.length, 0);
  } finally {
    await sql`DROP TRIGGER reject_fixture_background_job ON public.background_jobs`.execute(
      getDb(),
    );
    await sql`DROP FUNCTION public.reject_fixture_background_job()`.execute(
      getDb(),
    );
  }
});

test("catalog saves leave text and photo embeddings to the background worker", async () => {
  const actorId = await createAdminId();
  setGatewayHandler();
  const packageListing = await createPackageService(
    getDb(),
    packageContent("Deferred package"),
    actorId,
  );
  assert.ok(!("status" in packageListing));
  assert.equal(
    gatewayCalls.length,
    0,
    "saving a listing never calls the provider",
  );
  const packageOwner = { kind: "package", id: packageListing.id } as const;
  assert.ok(
    (await knowledgeRows(packageOwner)).every((row) => row.embedding === null),
  );
  const packageJob = await getDb()
    .selectFrom("background_jobs")
    .selectAll()
    .where("type", "=", "embed_package")
    .where("dedupe_key", "=", packageListing.id)
    .executeTakeFirstOrThrow();
  assert.equal(packageJob.status, "pending");
  assert.deepEqual(packageJob.payload, { packageId: packageListing.id });

  await drainCatalogJobs(getDb());
  assert.equal(gatewayCalls.length, 2);
  assert.ok(
    (await knowledgeRows(packageOwner)).every((row) => row.embedding !== null),
  );
  assert.ok(
    gatewayCalls.some((call) =>
      call.body.providerOptions?.google.content.some((parts) =>
        parts.some((part) => part.inlineData.data.length > 0),
      ),
    ),
    "worker embeds actual photo bytes",
  );
  assert.equal(
    (
      await getDb()
        .selectFrom("background_jobs")
        .select("status")
        .where("id", "=", packageJob.id)
        .executeTakeFirstOrThrow()
    ).status,
    "completed",
  );

  setGatewayHandler(
    () =>
      new Response(JSON.stringify({ error: { message: "fixture failure" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const serviceListing = await createServiceService(
    getDb(),
    serviceContent("Deferred service"),
    actorId,
  );
  assert.ok(!("status" in serviceListing));
  assert.equal(gatewayCalls.length, 0);
  const serviceOwner = { kind: "service", id: serviceListing.id } as const;
  await drainCatalogJobs(getDb());
  assert.equal(gatewayCalls.length, 2);
  assert.ok(
    (await knowledgeRows(serviceOwner)).every((row) => row.embedding === null),
  );
  const serviceJob = await getDb()
    .selectFrom("background_jobs")
    .selectAll()
    .where("type", "=", "embed_service")
    .where("dedupe_key", "=", serviceListing.id)
    .executeTakeFirstOrThrow();
  assert.equal(
    serviceJob.status,
    "pending",
    "partial embedding failures remain retryable",
  );
  assert.equal(serviceJob.attempts, 1);
  assert.ok(new Date(serviceJob.available_at).getTime() > Date.now());

  setGatewayHandler();
  await getDb()
    .updateTable("background_jobs")
    .set({ available_at: new Date(0) })
    .where("id", "=", serviceJob.id)
    .execute();
  await drainCatalogJobs(getDb());
  assert.equal(gatewayCalls.length, 2);
  assert.ok(
    (await knowledgeRows(serviceOwner)).every((row) => row.embedding !== null),
  );
  assert.equal(
    (
      await getDb()
        .selectFrom("background_jobs")
        .select("status")
        .where("id", "=", serviceJob.id)
        .executeTakeFirstOrThrow()
    ).status,
    "completed",
  );
});
