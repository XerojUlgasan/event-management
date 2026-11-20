import "dotenv/config";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Pool } from "pg";
import type { CatalogSection } from "@event-management/contracts/catalog";
import {
  sampleCatalogPhotoPaths,
  storedSectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { scenarioId } from "../src/db/seed/context.js";
import {
  planScenarioCatalog,
  seedScenarioCatalog,
} from "../src/db/seed/scenario/catalog.js";
import { planScenarioActivity } from "../src/db/seed/scenario/activity.js";
import { planScenarioUsers } from "../src/db/seed/scenario/users.js";
import { readCatalogSectionsService } from "../src/services/catalog-canvas/read-catalog-sections.js";
import { prepareCatalogKnowledge } from "../src/services/ai/workflows/prepare-catalog-knowledge.js";
import { searchPublicCatalogService } from "../src/services/ai/search-public-catalog.js";
import { getPublicCatalogItemService } from "../src/services/ai/get-public-catalog-item.js";

const database = `em_seed_test_${randomUUID().replaceAll("-", "")}`;

const workspaceDirectory = fileURLToPath(new URL("../../../", import.meta.url));

let admin: Pool;
let pool: Pool;
let created = false;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;

const catalogPlan = planScenarioCatalog();

const packageIds = catalogPlan.packages.map((item) => item.id);

const serviceIds = catalogPlan.services.map((item) => item.id);

const catalogMediaIds = [
  ...catalogPlan.canvases.map((page) =>
    scenarioId(`media:curated-catalog-v2:${page.key}`),
  ),
  ...Array.from({ length: 20 }, (_, index) =>
    scenarioId(`media:extra:${index}`),
  ),
];

async function applyMigrations(target: Pool) {
  const migrations = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(migrations, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await target.query(
      await readFile(
        new URL(`${entry.name}/migration.sql`, migrations),
        "utf8",
      ),
    );
  }
}

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
    "Tests require local PostgreSQL",
  );
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  pool = new Pool({ ...connection, database });
  await applyMigrations(pool);
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
});

after(async () => {
  await db?.destroy();
  await pool?.end();

  if (admin) {
    // Pool shutdown can resolve before PostgreSQL has finished disconnecting.
    // Wait for those connections to leave before forcibly dropping the test DB.
    if (created) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const remaining = await admin.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname = $1",
          [database],
        );

        if (remaining.rowCount === 0) break;

        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);

    await admin.end();
  }
});

async function runSeed(target = database) {
  await promisify(execFile)("pnpm", ["db:seed"], {
    cwd: workspaceDirectory,
    env: {
      ...process.env,
      DB_NAME: target,
      SEED_RANDOM_SEED: "seed-integration",
      SEED_CLOCK: "2026-10-31T00:00:00Z",
      FIREBASE_PROJECT_ID: "",
      FIREBASE_CLIENT_EMAIL: "",
      FIREBASE_PRIVATE_KEY: "",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      FIREBASE_AUTH_EMULATOR_HOST: "",
    },
  });
}

const tables = [
  "users",
  "sessions",
  "packages",
  "media_assets",
  "services",
  "booking_requests",
  "booking_request_status_history",
  "conversations",
  "messages",
  "events_day",
  "quotations",
  "audit_events",
] as const;

async function ids() {
  const snapshot: Record<string, string[]> = {};

  for (const table of tables) {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM ${table} ORDER BY id`,
    );
    snapshot[table] = result.rows.map((row) => row.id);
  }

  for (const table of ["packages", "services"]) {
    const result = await pool.query<{ id: string; canvas: unknown }>(
      `SELECT id, canvas FROM ${table} ORDER BY id`,
    );
    snapshot[`${table}_canvas`] = result.rows.map((row) =>
      JSON.stringify([row.id, row.canvas]),
    );
  }

  return snapshot;
}

async function read(path: string, cookie?: string) {
  const response = await app.request(`/v1${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  assert.equal(
    response.status,
    200,
    `GET ${path}: ${await response.clone().text()}`,
  );

  return response.json() as Promise<any>;
}

async function readAll(path: string, collection: string, cookie?: string) {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  do {
    const query = new URLSearchParams({
      limit: "50",
      ...(cursor ? { cursor } : {}),
    });
    const page = await read(`${path}?${query}`, cookie);
    assert.ok(Array.isArray(page[collection]));

    for (const row of page[collection]) {
      assert.ok(typeof row === "object" && row !== null && !Array.isArray(row));
      rows.push(row);
    }

    cursor = typeof page.nextCursor === "string" ? page.nextCursor : undefined;
  } while (cursor);

  return rows;
}

async function login(email: string) {
  const response = await app.request("/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "p@ssword01" }),
  });
  assert.equal(response.status, 200, `Login failed for ${email}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  return cookie;
}

function assertNoWidgetOverlaps(
  sections: Array<{
    title: string;
    widgets: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  }>,
) {
  for (const section of sections)
    for (let i = 0; i < section.widgets.length; i++)
      for (let j = i + 1; j < section.widgets.length; j++) {
        const left = section.widgets[i];
        const right = section.widgets[j];
        assert.ok(left && right);
        const overlaps =
          left.x < right.x + right.w &&
          right.x < left.x + left.w &&
          left.y < right.y + right.h &&
          right.y < left.y + left.h;
        assert.equal(
          overlaps,
          false,
          `Widgets ${left.id} and ${right.id} overlap in ${section.title}`,
        );
      }
}

function assertSubstantialEditorial(sections: CatalogSection[], name: string) {
  const bodies = sections.flatMap((section) =>
    section.widgets
      .filter((widget) => widget.type === "markdown")
      .map((widget) => widget.markdown),
  );

  assert.ok(
    bodies.length >= 5,
    `${name} has an introduction and detailed sections`,
  );
  // This prevents the original three-paragraph placeholder regression. Actual
  // relevance, commercial coherence and writing quality also need human review.
  const words = bodies
    .join(" ")
    .replace(/[|#*_>`-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  assert.ok(words.length >= 220, `${name} has substantial source material`);

  return bodies;
}

test("seed creates demo users and conversations while preserving unrelated data on rerun", async () => {
  await runSeed();
  const coverage = await pool.query(`SELECT
    (SELECT count(*)::int FROM booking_requests WHERE reference LIKE 'DEMO-%') AS requests,
    (SELECT count(*)::int FROM conversations c JOIN users u ON u.id = c.customer_id WHERE u.email LIKE 'demo.%@clemora.example.test') AS conversations,
    (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.customer_id WHERE u.email LIKE 'demo.%@clemora.example.test') AS messages,
    (SELECT count(*)::int FROM packages WHERE published_at IS NOT NULL AND archived_at IS NULL) AS package_published`);
  assert.deepEqual(coverage.rows[0], {
    requests: 0,
    conversations: 5,
    messages: 10,
    package_published: 21,
  });
  const scenario = await pool.query(
    `SELECT
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test') AS users,
    (SELECT count(DISTINCT password_hash)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test') AS password_hashes,
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test' AND role = 'admin') AS admins,
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test' AND role = 'customer') AS customers,
    (SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email LIKE 'scenario.user%@clemora.example.test') AS sessions,
    (SELECT count(*)::int FROM packages WHERE id = ANY($1::uuid[])) AS packages,
    (SELECT count(*)::int FROM services WHERE id = ANY($2::uuid[])) AS services,
    (SELECT count(*)::int FROM media_assets WHERE id = ANY($3::uuid[])) AS media,
    (SELECT count(*)::int FROM (
      SELECT canvas FROM packages WHERE id = ANY($1::uuid[])
      UNION ALL SELECT canvas FROM services WHERE id = ANY($2::uuid[])
    ) owners WHERE jsonb_array_length(canvas)>0) AS pages,
    (SELECT count(*)::int FROM (
      SELECT canvas FROM packages WHERE id = ANY($1::uuid[])
      UNION ALL SELECT canvas FROM services WHERE id = ANY($2::uuid[])
    ) owners CROSS JOIN LATERAL jsonb_array_elements(canvas) section) AS sections,
    (SELECT count(*)::int FROM (
      SELECT canvas FROM packages WHERE id = ANY($1::uuid[])
      UNION ALL SELECT canvas FROM services WHERE id = ANY($2::uuid[])
    ) owners CROSS JOIN LATERAL jsonb_array_elements(canvas) section
      CROSS JOIN LATERAL jsonb_array_elements(section->'widgets') widget) AS widgets,
    (SELECT count(*)::int FROM booking_requests WHERE reference LIKE 'SCN-%') AS bookings,
    (SELECT count(*)::int FROM booking_request_status_history h JOIN booking_requests b ON b.id = h.booking_request_id WHERE b.reference LIKE 'SCN-%') AS history,
    (SELECT count(*)::int FROM conversations c JOIN booking_requests b ON b.id = c.booking_request_id WHERE b.reference LIKE 'SCN-%') AS booking_conversations,
    (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN booking_requests b ON b.id = c.booking_request_id WHERE b.reference LIKE 'SCN-%' AND m.quotation_id IS NULL) AS booking_messages,
    (SELECT count(*)::int FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%') AS event_days`,
    [packageIds, serviceIds, catalogMediaIds],
  );
  const { sections, widgets, ...scenarioCounts } = scenario.rows[0];
  assert.deepEqual(scenarioCounts, {
    users: 100,
    password_hashes: 1,
    admins: 4,
    customers: 96,
    sessions: 100,
    packages: 20,
    services: 20,
    media: 60,
    pages: 40,
    bookings: 100,
    history: 100,
    booking_conversations: 100,
    booking_messages: 100,
    event_days: 100,
  });
  assert.ok(
    sections >= 80,
    "every curated listing has multiple canvas sections",
  );
  assert.ok(
    widgets >= 120,
    "every curated listing has opening copy and a photo",
  );

  type SeedPackage = {
    id: string;
    name: string;
    description: string;
    price: number;
    max_guests: number;
    package_type: "catalog" | "custom";
    archived_at: Date | null;
    canvas: unknown;
    thumbnail_media_id: string | null;
  };
  type SeedService = {
    id: string;
    name: string;
    description: string;
    hourly_rate_pesos: number | null;
    fixed_price_pesos: number | null;
    included_hours: number | null;
    archived_at: Date | null;
    canvas: unknown;
    thumbnail_media_id: string | null;
  };
  const seededPackages = await pool.query<SeedPackage>(
    "SELECT id, name, description, price, max_guests, package_type, archived_at, canvas, thumbnail_media_id FROM packages WHERE id = ANY($1::uuid[])",
    [packageIds],
  );
  const seededServices = await pool.query<SeedService>(
    "SELECT id, name, description, hourly_rate_pesos, fixed_price_pesos, included_hours, archived_at, canvas, thumbnail_media_id FROM services WHERE id = ANY($1::uuid[])",
    [serviceIds],
  );
  assert.equal(seededPackages.rowCount, 20);
  assert.equal(seededServices.rowCount, 20);

  const packageById = new Map(seededPackages.rows.map((row) => [row.id, row]));

  const serviceById = new Map(seededServices.rows.map((row) => [row.id, row]));

  const activeMarkdownBodies: string[] = [];
  const layoutSignatures = new Set<string>();
  let resolvedCatalogPhotos = 0;
  let activeListingsWithPhotos = 0;

  for (const page of catalogPlan.canvases) {
    const record =
      page.kind === "package"
        ? packageById.get(page.ownerId)
        : serviceById.get(page.ownerId);
    assert.ok(record, `seeded ${page.kind} ${page.ownerId} is present`);
    const stored = storedSectionsSchema.parse(record.canvas);
    const sections = await readCatalogSectionsService(db, {
      kind: page.kind,
      id: page.ownerId,
    });
    assert.equal(sections.length, stored.length);
    assert.ok(sections.length >= 2);
    assertNoWidgetOverlaps(sections);
    const sourceMarkdown = assertSubstantialEditorial(sections, record.name);
    layoutSignatures.add(
      JSON.stringify(
        sections.map((section) =>
          section.widgets
            .map((widget) => [
              widget.type,
              widget.x,
              widget.y,
              widget.w,
              widget.h,
            ])
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        ),
      ),
    );

    const photos = sections.flatMap((section) =>
      section.widgets.filter((widget) => widget.type === "photo"),
    );

    assert.equal(photos.length, 1, `${page.key} has one canvas photo`);
    const photo = photos[0];
    assert.ok(photo?.media, `${page.key} photo resolves to local media`);
    assert.equal(photo.media.source, "sample");
    assert.ok(sampleCatalogPhotoPaths.includes(photo.media.url));
    assert.ok(photo.alt.trim().length > 0);
    assert.equal(record.thumbnail_media_id, photo.media.id);
    await stat(
      resolve(workspaceDirectory, "apps/web/public", photo.media.url.slice(1)),
    );
    resolvedCatalogPhotos++;

    const archived = record.archived_at !== null;
    const knowledge =
      page.kind === "package"
        ? prepareCatalogKnowledge({
            kind: "package",
            record: record as SeedPackage,
            sections,
          })
        : prepareCatalogKnowledge({
            kind: "service",
            record: record as SeedService,
            sections,
          });

    if (archived) {
      assert.deepEqual(
        knowledge,
        [],
        `${page.key} archived listing is excluded`,
      );
      continue;
    }

    activeListingsWithPhotos++;

    const text = knowledge.filter((chunk) => chunk.chunkKey === "text");

    assert.equal(text.length, 1, `${page.key} has one combined text entry`);
    assert.ok(
      knowledge.some(
        (chunk) => chunk.chunkKey.startsWith("photo:") && chunk.mediaId,
      ),
      `${page.key} contributes photo knowledge`,
    );
    const combined = text[0]?.contentMarkdown ?? "";

    for (const body of sourceMarkdown)
      assert.ok(
        combined.includes(body),
        `${page.key} indexes complete authored Markdown`,
      );

    const bodies = sourceMarkdown;
    activeMarkdownBodies.push(...bodies);
    assert.ok(
      new Set(bodies).size >= 2,
      `${page.key} has distinct meaningful copy`,
    );
  }

  assert.equal(resolvedCatalogPhotos, 40);
  assert.equal(activeListingsWithPhotos, 36);
  assert.ok(layoutSignatures.size >= 5, "seed canvases exercise five layouts");
  assert.ok(
    new Set(activeMarkdownBodies).size >= activeListingsWithPhotos * 2,
    "active catalog text varies beyond listing IDs and headings",
  );
  assert.ok(
    seededServices.rows.some(
      (service) =>
        service.archived_at === null && service.fixed_price_pesos !== null,
    ),
  );
  assert.ok(
    seededServices.rows.some(
      (service) =>
        service.archived_at === null && service.fixed_price_pesos === null,
    ),
  );
  const packageSearchPlan = catalogPlan.packages[0];
  assert.ok(packageSearchPlan);
  const packageSearchTarget = packageById.get(packageSearchPlan.id);
  assert.ok(packageSearchTarget);
  const fixedSearchPlan = catalogPlan.services[0];
  assert.ok(fixedSearchPlan);
  const fixedSearchTarget = serviceById.get(fixedSearchPlan.id);
  assert.ok(fixedSearchTarget && fixedSearchTarget.fixed_price_pesos !== null);
  const fixedPrice = fixedSearchTarget.fixed_price_pesos;
  assert.ok(fixedPrice !== null);

  const hourlySearchTarget = seededServices.rows.find(
    (service) =>
      service.archived_at === null && service.fixed_price_pesos === null,
  );

  assert.ok(hourlySearchTarget);
  const hourlyRate = hourlySearchTarget.hourly_rate_pesos;
  assert.ok(hourlyRate !== null);
  const originalFetch = globalThis.fetch;
  let fetchAttempts = 0;
  globalThis.fetch = async (..._args) => {
    fetchAttempts++;
    throw new Error("Queryless catalog smoke must not call a provider");
  };

  try {
    const packageResults = await searchPublicCatalogService({
      db,
      input: {
        catalogType: "package",
        minPricePesos: packageSearchTarget.price,
        maxPricePesos: packageSearchTarget.price,
        pax: Math.min(30, packageSearchTarget.max_guests),
      },
    });
    assert.ok(
      packageResults.results.some((row) => row.id === packageSearchTarget.id),
    );
    assert.ok(
      packageResults.results.every(
        (row) =>
          row.price.amountPesos === packageSearchTarget.price &&
          (row.capacity ?? 0) >= Math.min(30, packageSearchTarget.max_guests),
      ),
    );
    const fixedResults = await searchPublicCatalogService({
      db,
      input: {
        catalogType: "service",
        pricingType: "fixed",
        minPricePesos: fixedPrice,
        maxPricePesos: fixedPrice,
      },
    });
    assert.ok(
      fixedResults.results.some((row) => row.id === fixedSearchTarget.id),
    );
    const hourlyResults = await searchPublicCatalogService({
      db,
      input: {
        catalogType: "service",
        pricingType: "hourly",
        minPricePesos: hourlyRate,
        maxPricePesos: hourlyRate,
      },
    });
    assert.ok(
      hourlyResults.results.some((row) => row.id === hourlySearchTarget.id),
    );
    assert.equal(fetchAttempts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const packageDetailInput = {
    catalogType: "package" as const,
    id: packageSearchTarget.id,
  };
  const packageDetail = await getPublicCatalogItemService({
    db,
    input: packageDetailInput,
  });
  assert.match(packageDetail.markdown, /## The concept|## The occasion/);
  const serviceDetail = await getPublicCatalogItemService({
    db,
    input: { catalogType: "service", id: fixedSearchTarget.id },
  });
  assert.ok(serviceDetail.markdown.includes(fixedSearchTarget.name));
  const longDescription = `${packageSearchTarget.description}\n${"Pagination scope detail. ".repeat(140)}`;
  assert.ok(longDescription.length <= MAX_CATALOG_TEXT_LENGTH);
  await pool.query("UPDATE packages SET description = $1 WHERE id = $2", [
    longDescription,
    packageSearchTarget.id,
  ]);
  const firstDetailPage = await getPublicCatalogItemService({
    db,
    input: packageDetailInput,
  });
  const firstDetailCursor = firstDetailPage.nextCursor;
  assert.ok(firstDetailCursor);
  let detailCursor: string | null = firstDetailCursor;
  let detailDocument = firstDetailPage.markdown;
  let detailPages = 1;

  while (detailCursor) {
    const nextPage = await getPublicCatalogItemService({
      db,
      input: { ...packageDetailInput, cursor: detailCursor },
    });
    detailDocument += nextPage.markdown;
    detailCursor = nextPage.nextCursor;
    detailPages++;
  }

  assert.ok(detailPages > 1);
  assert.ok(detailDocument.includes("Pagination scope detail."));
  const otherPackage = catalogPlan.packages[1];
  assert.ok(otherPackage);
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: {
        catalogType: "package",
        id: otherPackage.id,
        cursor: firstDetailCursor,
      },
    }),
    /Invalid pagination cursor/,
  );
  const quotationCoverage = await pool.query(`SELECT
    count(*)::int AS quotations, count(DISTINCT q.booking_request_id)::int AS bookings,
    count(*) FILTER (WHERE q.status = 'draft')::int AS drafts,
    count(*) FILTER (WHERE q.status = 'sent')::int AS sent,
    count(*) FILTER (WHERE q.status = 'superseded')::int AS superseded,
    count(*) FILTER (WHERE jsonb_array_length(q.items) = 0)::int AS base_only,
    count(*) FILTER (WHERE q.sent_at IS NOT NULL)::int AS delivered,
    (SELECT count(*)::int FROM audit_events WHERE entity_type = 'quotation') AS audit_events
    FROM quotations q JOIN booking_requests b ON b.id = q.booking_request_id WHERE b.reference LIKE 'SCN-%'`);
  assert.deepEqual(quotationCoverage.rows[0], {
    quotations: 100,
    bookings: 50,
    drafts: 17,
    sent: 33,
    superseded: 50,
    base_only: 26,
    delivered: 83,
    audit_events: 253,
  });
  const quotationViolations = await pool.query(`SELECT q.id FROM quotations q
    JOIN booking_requests b ON b.id = q.booking_request_id
    JOIN users creator ON creator.id = q.created_by
    LEFT JOIN packages p ON p.id = q.offered_package_id
    LEFT JOIN quotations previous ON previous.id = q.previous_quotation_id
    LEFT JOIN messages m ON m.quotation_id = q.id
    LEFT JOIN conversations c ON c.id = m.conversation_id
    WHERE b.reference LIKE 'SCN-%' AND (
      creator.role <> 'admin'
      OR b.status IN ('declined', 'cancelled') OR p.id IS NULL
      OR p.id <> b.package_id OR q.base_amount_minor <> p.price * 100 OR q.currency <> 'PHP'
      OR NOT clemora_quotation_items_valid(q.items)
      OR q.total_amount_minor <> clemora_quotation_total(q.base_amount_minor, q.items)
      OR q.total_amount_minor < 0 OR q.created_at > q.updated_at
      OR (q.status = 'draft' AND (q.sent_at IS NOT NULL OR q.adjustments_reviewed))
      OR (q.status <> 'draft' AND (q.sent_at IS NULL OR NOT q.adjustments_reviewed))
      OR (q.status = 'superseded') IS DISTINCT FROM (q.superseded_at IS NOT NULL)
      OR (q.version = 1 AND q.previous_quotation_id IS NOT NULL)
      OR (q.version = 2 AND (previous.id IS NULL OR previous.booking_request_id <> q.booking_request_id
        OR previous.version <> 1 OR previous.status <> 'superseded' OR q.revision_reason IS NULL
        OR previous.superseded_at <> q.created_at OR previous.items <> q.items))
      OR (q.sent_at IS NOT NULL AND (m.id IS NULL OR c.booking_request_id <> b.id
        OR c.status <> 'active' OR m.sender_id <> q.created_by OR m.sender_role <> 'admin'
        OR m.created_at <> q.sent_at OR q.sent_at < q.created_at))
      OR (q.sent_at IS NULL AND m.id IS NOT NULL)
      OR NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.entity_id = q.id
        AND a.action = CASE WHEN q.version = 1 THEN 'quotation.created' ELSE 'quotation.revised' END
        AND a.actor_id = q.created_by)
      OR (q.sent_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_events a
        WHERE a.entity_id = q.id AND a.action = 'quotation.sent' AND a.actor_id = q.created_by))
    )`);
  assert.deepEqual(quotationViolations.rows, []);
  const activeDuplicates =
    await pool.query(`SELECT booking_request_id FROM quotations
    WHERE status IN ('draft', 'sent') GROUP BY booking_request_id HAVING count(*) > 1`);
  assert.deepEqual(activeDuplicates.rows, []);
  const sampleQuotation = await pool.query<{
    id: string;
    booking_request_id: string;
    email: string;
  }>(`
    SELECT q.id, q.booking_request_id, u.email FROM quotations q
    JOIN booking_requests b ON b.id = q.booking_request_id JOIN users u ON u.id = b.customer_id
    WHERE q.status = 'draft' ORDER BY q.id LIMIT 1`);
  const quotation = sampleQuotation.rows[0];
  assert.ok(quotation);
  const violations = await pool.query(
    `SELECT
    (SELECT count(*)::int FROM booking_requests b JOIN users u ON u.id = b.customer_id WHERE b.reference LIKE 'SCN-%' AND u.role <> 'customer') AS non_customer_bookings,
    (SELECT count(*)::int FROM booking_requests b JOIN packages p ON p.id = b.package_id WHERE b.reference LIKE 'SCN-%' AND b.out_of_range IS DISTINCT FROM (b.guest_count IS NOT NULL AND b.guest_count > p.max_guests)) AS range_mismatches,
    (SELECT count(*)::int FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%' AND b.status <> 'accepted') AS days_outside_accepted,
    (SELECT count(*)::int FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%' AND d.status = 'moved' AND NOT EXISTS (SELECT 1 FROM events_day r WHERE r.id = d.replacement_event_day_id AND r.booking_request_id = d.booking_request_id AND r.status = 'scheduled')) AS broken_moves,
    (SELECT count(*)::int FROM messages m JOIN users u ON u.id = m.sender_id JOIN conversations c ON c.id = m.conversation_id JOIN booking_requests b ON b.id = c.booking_request_id WHERE b.reference LIKE 'SCN-%' AND m.sender_role::text <> u.role) AS sender_mismatches,
    (SELECT count(*)::int FROM services s WHERE s.id = ANY($1::uuid[]) AND s.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s.canvas) section CROSS JOIN LATERAL jsonb_array_elements(section->'widgets') widget WHERE widget->>'type' = 'photo')) AS services_without_photos,
    (SELECT count(*)::int FROM booking_requests b JOIN packages p ON p.id = b.package_id WHERE b.reference LIKE 'SCN-%' AND p.archived_at IS NOT NULL) AS archived_package_bookings`,
    [serviceIds],
  );
  assert.deepEqual(violations.rows[0], {
    non_customer_bookings: 0,
    range_mismatches: 0,
    days_outside_accepted: 0,
    broken_moves: 0,
    sender_mismatches: 0,
    services_without_photos: 0,
    archived_package_bookings: 0,
  });
  const bookingDates = await pool.query<{
    min_day: string;
    max_day: string;
    outside: number;
  }>(`SELECT min(day) AS min_day, max(day) AS max_day,
    count(*) FILTER (WHERE day < '2026-10-01' OR day > '2026-11-30')::int AS outside
    FROM (
      SELECT preferred_date AS day FROM booking_requests WHERE reference LIKE 'SCN-%'
      UNION ALL
      SELECT to_char(d.day, 'YYYY-MM-DD') FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%'
      UNION ALL
      SELECT value->>'date' FROM booking_requests b CROSS JOIN LATERAL jsonb_array_elements(b.requested_days) value WHERE b.reference LIKE 'SCN-%' AND b.requested_days IS NOT NULL
    ) days`);
  assert.deepEqual(bookingDates.rows[0], {
    min_day: "2026-10-01",
    max_day: "2026-11-30",
    outside: 0,
  });
  const bookingStatuses = await pool.query(
    "SELECT status, count(*)::int AS count FROM booking_requests WHERE reference LIKE 'SCN-%' GROUP BY status ORDER BY status",
  );
  assert.deepEqual(bookingStatuses.rows, [
    { status: "accepted", count: 50 },
    { status: "cancelled", count: 5 },
    { status: "declined", count: 10 },
    { status: "needs_details", count: 10 },
    { status: "under_review", count: 25 },
  ]);
  const dayStatuses = await pool.query(
    "SELECT d.status, count(*)::int AS count FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%' GROUP BY d.status ORDER BY d.status",
  );
  assert.deepEqual(dayStatuses.rows, [
    { status: "cancelled", count: 8 },
    { status: "moved", count: 8 },
    { status: "scheduled", count: 84 },
  ]);
  const packageRows = await pool.query(
    "SELECT id, name, max_guests, price, published_at IS NOT NULL AS published FROM packages WHERE name IN ('The Grand Celebration', 'The Intimate Gathering', 'The Sweet Soirée') ORDER BY name",
  );
  assert.deepEqual(
    packageRows.rows.map((row) => ({
      name: row.name,
      maxGuests: row.max_guests,
      price: row.price,
      published: row.published,
    })),
    [
      {
        name: "The Grand Celebration",
        maxGuests: 150,
        price: 185000,
        published: true,
      },
      {
        name: "The Intimate Gathering",
        maxGuests: 50,
        price: 68000,
        published: true,
      },
      {
        name: "The Sweet Soirée",
        maxGuests: 80,
        price: 95000,
        published: true,
      },
    ],
  );

  const grandCelebration = packageRows.rows.find(
    (row) => row.name === "The Grand Celebration",
  );

  assert.ok(grandCelebration);
  const packagePageContent = await pool.query(`
    SELECT p.name,
      count(DISTINCT section->>'id')::int AS sections,
      count(DISTINCT widget->>'id') FILTER (WHERE widget->>'type' = 'markdown')::int AS markdown_widgets,
      count(DISTINCT widget->>'id') FILTER (WHERE widget->>'type' = 'photo' AND m.source = 'sample')::int AS sample_photo_widgets
    FROM packages p
    LEFT JOIN LATERAL jsonb_array_elements(p.canvas) section ON true
    LEFT JOIN LATERAL jsonb_array_elements(section->'widgets') widget ON true
    LEFT JOIN media_assets m ON m.id::text = widget->>'mediaId'
    WHERE p.name IN ('The Grand Celebration', 'The Intimate Gathering', 'The Sweet Soirée')
    GROUP BY p.id, p.name
    ORDER BY p.name`);
  assert.equal(packagePageContent.rowCount, 3);
  assert.ok(
    packagePageContent.rows.every(
      (row) =>
        row.sections > 0 &&
        row.markdown_widgets > 0 &&
        row.sample_photo_widgets > 0,
    ),
  );
  const publicPackages = await readAll("/packages", "packages");
  const sampleNames = [
    "The Grand Celebration",
    "The Intimate Gathering",
    "The Sweet Soirée",
  ];

  const samplePackages = publicPackages.filter((row: any) =>
    sampleNames.includes(row.name),
  );

  assert.deepEqual(
    samplePackages.map((row: any) => row.name).sort(),
    sampleNames,
  );
  const seededSamplePackages = await pool.query<SeedPackage>(
    "SELECT id, name, description, price, max_guests, package_type, archived_at, canvas, thumbnail_media_id FROM packages WHERE name = ANY($1::text[])",
    [sampleNames],
  );
  assert.equal(seededSamplePackages.rowCount, 3);

  for (const sample of seededSamplePackages.rows) {
    const sections = await readCatalogSectionsService(db, {
      kind: "package",
      id: sample.id,
    });
    assertNoWidgetOverlaps(sections);
    const sourceMarkdown = assertSubstantialEditorial(sections, sample.name);
    const chunks = prepareCatalogKnowledge({
      kind: "package",
      record: sample,
      sections,
    });

    const text = chunks.filter((chunk) => chunk.chunkKey === "text");

    assert.equal(text.length, 1);

    for (const body of sourceMarkdown)
      assert.ok(text[0]?.contentMarkdown.includes(body));

    const photo = sections
      .flatMap((section) => section.widgets)
      .find((widget) => widget.type === "photo");

    assert.ok(photo?.media);
    assert.ok(sampleCatalogPhotoPaths.includes(photo.media.url));
    assert.equal(sample.thumbnail_media_id, photo.media.id);
    await stat(
      resolve(workspaceDirectory, "apps/web/public", photo.media.url.slice(1)),
    );
  }

  assert.equal(
    publicPackages.filter((row: any) => packageIds.includes(row.id)).length,
    18,
  );
  assert.ok(
    samplePackages.every((pkg: any) => {
      const widgets = pkg.sections.flatMap((section: any) => section.widgets);

      return (
        widgets.some((widget: any) => widget.type === "markdown") &&
        widgets.some(
          (widget: any) =>
            widget.type === "photo" && widget.media?.source === "sample",
        )
      );
    }),
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int AS count FROM services")).rows[0]
      .count,
    20,
  );
  const conversation =
    await pool.query(`SELECT c.id, c.customer_id, count(m.id)::int AS message_count,
    array_agg(u.role ORDER BY m.created_at) AS sender_roles,
    array_agg(m.sender_role ORDER BY m.created_at) AS message_roles
    FROM conversations c JOIN users customer ON customer.id = c.customer_id
    JOIN messages m ON m.conversation_id = c.id JOIN users u ON u.id = m.sender_id
    WHERE customer.email = 'demo.camille@clemora.example.test' GROUP BY c.id`);
  assert.equal(conversation.rowCount, 1);
  assert.equal(conversation.rows[0].message_count, 2);
  assert.deepEqual(conversation.rows[0].sender_roles, ["customer", "admin"]);
  assert.deepEqual(conversation.rows[0].message_roles, ["customer", "admin"]);

  await pool.query("UPDATE packages SET price = price + 1 WHERE id = $1", [
    grandCelebration.id,
  ]);
  const scenarioPackage = await pool.query(
    "SELECT id FROM packages WHERE id = $1",
    [catalogPlan.packages[1]?.id],
  );
  assert.equal(scenarioPackage.rowCount, 1);
  await pool.query("UPDATE packages SET price = 12345 WHERE id = $1", [
    scenarioPackage.rows[0].id,
  ]);
  await pool.query(
    "UPDATE quotations SET base_amount_minor = base_amount_minor + 123, total_amount_minor = total_amount_minor + 123, revision_reason = 'Edited draft' WHERE id = $1",
    [quotation.id],
  );
  // Closing a parent after seeding must not replace its quotations with a different booking.
  await pool.query(
    "UPDATE booking_requests SET status = 'cancelled' WHERE id = $1",
    [quotation.booking_request_id],
  );
  await pool.query(
    "UPDATE conversations SET status = 'closed', closed_at = now() WHERE booking_request_id = $1",
    [quotation.booking_request_id],
  );
  const quotationsBeforeRerun = await pool.query(
    "SELECT * FROM quotations ORDER BY id",
  );
  const auditsBeforeRerun = await pool.query(
    "SELECT * FROM audit_events ORDER BY id",
  );
  const messagesBeforeRerun = await pool.query(
    "SELECT * FROM messages WHERE quotation_id IS NOT NULL ORDER BY id",
  );
  const unrelated = await pool.query(
    "INSERT INTO users (email, display_name, role, password_hash) VALUES ($1, $2, 'customer', 'unused') RETURNING id",
    ["unrelated-seed-test@example.test", "Unrelated person"],
  );
  // Canvas children now belong to the owner: reruns must preserve an intentional
  // removal as well as edits inside a saved document.
  await pool.query("UPDATE packages SET canvas='[]'::jsonb WHERE id=$1", [
    catalogPlan.packages[0]?.id,
  ]);
  await pool.query(
    `UPDATE services SET canvas=jsonb_set(canvas, '{0,title}', '"Edited service canvas"'::jsonb)
    WHERE id=$1`,
    [catalogPlan.services[0]?.id],
  );
  const beforeRerun = await ids();
  await runSeed();
  assert.deepEqual(
    (
      await pool.query("SELECT canvas FROM packages WHERE id=$1", [
        catalogPlan.packages[0]?.id,
      ])
    ).rows[0].canvas,
    [],
  );
  assert.equal(
    (
      await pool.query(
        "SELECT canvas->0->>'title' AS title FROM services WHERE id=$1",
        [catalogPlan.services[0]?.id],
      )
    ).rows[0].title,
    "Edited service canvas",
  );

  assert.deepEqual(await ids(), beforeRerun);
  assert.deepEqual(
    (await pool.query("SELECT * FROM quotations ORDER BY id")).rows,
    quotationsBeforeRerun.rows,
  );
  assert.deepEqual(
    (await pool.query("SELECT * FROM audit_events ORDER BY id")).rows,
    auditsBeforeRerun.rows,
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT * FROM messages WHERE quotation_id IS NOT NULL ORDER BY id",
      )
    ).rows,
    messagesBeforeRerun.rows,
  );
  assert.equal(
    (
      await pool.query("SELECT price FROM packages WHERE id = $1", [
        grandCelebration.id,
      ])
    ).rows[0].price,
    185001,
  );
  assert.equal(
    (
      await pool.query("SELECT price FROM packages WHERE id = $1", [
        scenarioPackage.rows[0].id,
      ])
    ).rows[0].price,
    12345,
  );
  assert.equal(
    (
      await pool.query("SELECT display_name FROM users WHERE id = $1", [
        unrelated.rows[0].id,
      ])
    ).rows[0].display_name,
    "Unrelated person",
  );

  const publicServices = { services: await readAll("/services", "services") };
  assert.equal(publicServices.services.length, 18);
  assert.ok(
    publicServices.services.every(
      (service: any) =>
        service.hourlyRatePesos > 0 && typeof service.imageUrl === "string",
    ),
  );
  const customerCookie = await login("demo.camille@clemora.example.test");
  const adminCookie = await login("demo.admin@clemora.example.test");
  assert.equal(
    (await read("/booking-requests/mine", customerCookie)).bookingRequests
      .length,
    0,
  );
  const customerThread = await read("/messages/conversation", customerCookie);
  assert.equal(customerThread.conversation.id, conversation.rows[0].id);
  assert.equal(customerThread.messages.length, 2);
  assert.equal(
    (await readAll("/admin/booking-requests", "bookingRequests", adminCookie))
      .length,
    100,
  );
  const scenarioAdmin = await login("scenario.user001@clemora.example.test");
  assert.equal((await read("/me", scenarioAdmin)).role, "admin");
  assert.equal("staffRole" in (await read("/me", scenarioAdmin)), false);
  assert.ok(
    (await readAll("/admin/conversations", "conversations", adminCookie)).some(
      (row: any) => row.id === conversation.rows[0].id,
    ),
  );
  const quotationCustomerCookie = await login(quotation.email);
  const adminQuotations = (
    await read(
      `/admin/booking-requests/${quotation.booking_request_id}/quotations`,
      scenarioAdmin,
    )
  ).quotations;
  const customerQuotations = (
    await read(
      `/booking-requests/${quotation.booking_request_id}/quotations`,
      quotationCustomerCookie,
    )
  ).quotations;
  assert.equal(adminQuotations.length, 2);
  assert.equal(customerQuotations.length, 1);
  assert.equal(customerQuotations[0].status, "superseded");
  assert.ok(
    !customerQuotations.some((row: { id: string }) => row.id === quotation.id),
  );
  const offeredQuotation = (
    await read(
      `/quotations/${customerQuotations[0].id}`,
      quotationCustomerCookie,
    )
  ).quotation;
  assert.equal(offeredQuotation.id, customerQuotations[0].id);
  assert.deepEqual(offeredQuotation.items, customerQuotations[0].items);

  const archivedCandidate = catalogPlan.packages[0];
  const changedActiveCandidate = catalogPlan.packages[1];
  assert.ok(archivedCandidate);
  assert.ok(changedActiveCandidate);
  await pool.query(
    "UPDATE packages SET price = 111111, max_guests = 5, archived_at = $1 WHERE id = $2",
    [new Date("2026-10-31T00:00:00.000Z"), archivedCandidate.id],
  );
  await pool.query(
    "UPDATE packages SET price = 23456, max_guests = 44, archived_at = NULL WHERE id = $1",
    [changedActiveCandidate.id],
  );
  const scenarioUsers = planScenarioUsers();

  const scenarioAdminUser = scenarioUsers.find((user) => user.role === "admin");

  assert.ok(scenarioAdminUser);

  const persistedCatalog = await db.transaction().execute((trx) =>
    seedScenarioCatalog(trx, {
      catalog: catalogPlan,
      users: scenarioUsers,
      now: new Date("2026-10-31T00:00:00.000Z"),
    }),
  );

  const returnedArchived = persistedCatalog.packages.find(
    (item) => item.id === archivedCandidate.id,
  );

  const returnedActive = persistedCatalog.packages.find(
    (item) => item.id === changedActiveCandidate.id,
  );

  assert.deepEqual(
    returnedArchived && {
      price: returnedArchived.price,
      maxGuests: returnedArchived.maxGuests,
      archived: returnedArchived.archived,
    },
    { price: 111111, maxGuests: 5, archived: true },
  );
  assert.deepEqual(
    returnedActive && {
      price: returnedActive.price,
      maxGuests: returnedActive.maxGuests,
      archived: returnedActive.archived,
    },
    { price: 23456, maxGuests: 44, archived: false },
  );

  const rerunActivity = planScenarioActivity({
    users: scenarioUsers,
    packages: persistedCatalog.packages,
    now: new Date("2026-10-31T00:00:00.000Z"),
    random: () => 0.5,
  });

  const returnedActiveIds = new Set(
    persistedCatalog.packages
      .filter((item) => !item.archived)
      .map((item) => item.id),
  );

  assert.ok(
    rerunActivity.bookings.every((booking) =>
      returnedActiveIds.has(booking.packageId),
    ),
  );
  assert.ok(
    rerunActivity.bookings.some(
      (booking) => booking.packageId === changedActiveCandidate.id,
    ),
  );

  const legacyServicePage = catalogPlan.canvases.find(
    (page) => page.kind === "service" && page.index === 19,
  );

  assert.ok(legacyServicePage);
  const legacyMediaId = scenarioId("media:service:19");
  const curatedMediaId = scenarioId(
    `media:curated-catalog-v2:${legacyServicePage.key}`,
  );
  await pool.query(
    "UPDATE services SET thumbnail_media_id = NULL, canvas = '[]'::jsonb WHERE id = $1",
    [legacyServicePage.ownerId],
  );
  await pool.query("DELETE FROM services WHERE id = $1", [
    legacyServicePage.ownerId,
  ]);
  await pool.query("DELETE FROM media_assets WHERE id = $1", [curatedMediaId]);
  await pool.query(
    `INSERT INTO media_assets (id, kind, source, url, created_by, created_at)
     VALUES ($1, 'image', 'sample', '/images/hero.jpg', $2, $3)`,
    [legacyMediaId, scenarioAdminUser.id, new Date("2026-10-31T00:00:00.000Z")],
  );
  await db.transaction().execute((trx) =>
    seedScenarioCatalog(trx, {
      catalog: catalogPlan,
      users: scenarioUsers,
      now: new Date("2026-10-31T00:00:00.000Z"),
    }),
  );
  const preservedLegacyPhoto = await pool.query<{ url: string }>(
    "SELECT url FROM media_assets WHERE id = $1",
    [legacyMediaId],
  );
  assert.deepEqual(preservedLegacyPhoto.rows, [{ url: "/images/hero.jpg" }]);
  const rebuiltSections = await readCatalogSectionsService(db, {
    kind: "service",
    id: legacyServicePage.ownerId,
  });

  const rebuiltPhoto = rebuiltSections
    .flatMap((section) => section.widgets)
    .find((widget) => widget.type === "photo");

  assert.ok(rebuiltPhoto?.media);
  assert.equal(rebuiltPhoto.media.id, curatedMediaId);
  assert.equal(rebuiltPhoto.media.url, legacyServicePage.copy.photo);
  assert.equal(rebuiltPhoto.alt, legacyServicePage.copy.alt);
});
