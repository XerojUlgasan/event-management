import "dotenv/config";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Pool } from "pg";

const database = `em_seed_test_${randomUUID().replaceAll("-", "")}`;
const workspaceDirectory = fileURLToPath(new URL("../../../", import.meta.url));
let admin: Pool;
let pool: Pool;
let created = false;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;

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
  "catalog_pages",
  "catalog_sections",
  "catalog_widgets",
  "media_assets",
  "services",
  "venues",
  "booking_requests",
  "booking_request_status_history",
  "conversations",
  "messages",
  "events_day",
  "event_staff_availability",
  "event_staffs",
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

test("seed creates demo users, venues, and conversations while preserving unrelated data on rerun", async () => {
  await runSeed();
  const coverage = await pool.query(`SELECT
    (SELECT count(*)::int FROM booking_requests WHERE reference LIKE 'DEMO-%') AS requests,
    (SELECT count(*)::int FROM conversations c JOIN users u ON u.id = c.customer_id WHERE u.email LIKE 'demo.%@clemora.example.test') AS conversations,
    (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.customer_id WHERE u.email LIKE 'demo.%@clemora.example.test') AS messages,
    (SELECT count(*)::int FROM packages WHERE published_at IS NOT NULL) AS package_published,
    (SELECT count(*)::int FROM venues WHERE name LIKE 'Demo %' AND archived_at IS NULL) AS venue_published`);
  assert.deepEqual(coverage.rows[0], {
    requests: 0,
    conversations: 5,
    messages: 10,
    package_published: 103,
    venue_published: 3,
  });
  const scenario = await pool.query(`SELECT
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test') AS users,
    (SELECT count(DISTINCT password_hash)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test') AS password_hashes,
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test' AND role = 'admin' AND staff_role = 'System Administrator') AS admins,
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test' AND role = 'staff' AND staff_role IS NOT NULL) AS staff,
    (SELECT count(*)::int FROM users WHERE email LIKE 'scenario.user%@clemora.example.test' AND role = 'customer' AND staff_role IS NULL) AS customers,
    (SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email LIKE 'scenario.user%@clemora.example.test') AS sessions,
    (SELECT count(*)::int FROM packages WHERE name LIKE 'Scenario Celebration %') AS packages,
    (SELECT count(*)::int FROM venues WHERE name LIKE 'Scenario Venue %') AS venues,
    (SELECT count(*)::int FROM services WHERE name LIKE 'Scenario Service %') AS services,
    (SELECT count(*)::int FROM media_assets) AS media,
    (SELECT count(*)::int FROM catalog_pages) AS pages,
    (SELECT count(*)::int FROM catalog_sections) AS sections,
    (SELECT count(*)::int FROM catalog_widgets) AS widgets,
    (SELECT count(*)::int FROM booking_requests WHERE reference LIKE 'SCN-%') AS bookings,
    (SELECT count(*)::int FROM booking_request_status_history h JOIN booking_requests b ON b.id = h.booking_request_id WHERE b.reference LIKE 'SCN-%') AS history,
    (SELECT count(*)::int FROM conversations c JOIN booking_requests b ON b.id = c.booking_request_id WHERE b.reference LIKE 'SCN-%') AS booking_conversations,
    (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN booking_requests b ON b.id = c.booking_request_id WHERE b.reference LIKE 'SCN-%' AND m.quotation_id IS NULL) AS booking_messages,
    (SELECT count(*)::int FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%') AS event_days,
    (SELECT count(*)::int FROM event_staff_availability a JOIN events_day d ON d.id = a.event_day_id JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%') AS availability,
    (SELECT count(*)::int FROM event_staffs s JOIN events_day d ON d.id = s.event_day_id JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%') AS assignments`);
  assert.deepEqual(scenario.rows[0], {
    users: 100,
    password_hashes: 1,
    admins: 4,
    staff: 24,
    customers: 72,
    sessions: 100,
    packages: 100,
    venues: 100,
    services: 100,
    media: 103,
    pages: 103,
    sections: 103,
    widgets: 106,
    bookings: 100,
    history: 100,
    booking_conversations: 100,
    booking_messages: 100,
    event_days: 100,
    availability: 100,
    assignments: 100,
  });
  const quotationCoverage = await pool.query(`SELECT
    count(*)::int AS quotations, count(DISTINCT q.booking_request_id)::int AS bookings,
    count(*) FILTER (WHERE q.status = 'draft')::int AS drafts,
    count(*) FILTER (WHERE q.status = 'sent')::int AS sent,
    count(*) FILTER (WHERE q.status = 'accepted')::int AS accepted,
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
    accepted: 0,
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
      creator.role <> 'admin' OR creator.staff_role IS DISTINCT FROM 'System Administrator'
      OR b.status IN ('declined', 'cancelled') OR p.id IS NULL
      OR p.id <> b.package_id OR q.base_amount_minor <> p.price * 100 OR q.currency <> 'PHP'
      OR NOT clemora_quotation_items_valid(q.items)
      OR q.total_amount_minor <> clemora_quotation_total(q.base_amount_minor, q.items)
      OR q.total_amount_minor < 0 OR q.created_at > q.updated_at
      OR (q.status = 'draft' AND (q.sent_at IS NOT NULL OR q.adjustments_reviewed))
      OR (q.status <> 'draft' AND (q.sent_at IS NULL OR NOT q.adjustments_reviewed))
      OR (q.status = 'accepted') IS DISTINCT FROM (q.accepted_at IS NOT NULL)
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
      OR (q.accepted_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_events a
        WHERE a.entity_id = q.id AND a.action = 'quotation.accepted' AND a.actor_id = b.customer_id))
    )`);
  assert.deepEqual(quotationViolations.rows, []);
  const activeDuplicates =
    await pool.query(`SELECT booking_request_id FROM quotations
    WHERE status IN ('draft', 'sent', 'accepted') GROUP BY booking_request_id HAVING count(*) > 1`);
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
  const violations = await pool.query(`SELECT
    (SELECT count(*)::int FROM booking_requests b JOIN users u ON u.id = b.customer_id WHERE b.reference LIKE 'SCN-%' AND u.role <> 'customer') AS non_customer_bookings,
    (SELECT count(*)::int FROM booking_requests WHERE reference LIKE 'SCN-%' AND out_of_range IS DISTINCT FROM (guest_count IS NOT NULL AND guest_count > package_max_guests)) AS range_mismatches,
    (SELECT count(*)::int FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%' AND b.status <> 'accepted') AS days_outside_accepted,
    (SELECT count(*)::int FROM events_day d JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%' AND d.status = 'moved' AND NOT EXISTS (SELECT 1 FROM events_day r WHERE r.id = d.replacement_event_day_id AND r.booking_request_id = d.booking_request_id AND r.status = 'scheduled')) AS broken_moves,
    (SELECT count(*)::int FROM event_staffs s JOIN events_day d ON d.id = s.event_day_id JOIN booking_requests b ON b.id = d.booking_request_id WHERE b.reference LIKE 'SCN-%' AND s.status = 'confirmed' AND (d.status <> 'scheduled' OR d.staffing_status <> 'closed' OR NOT EXISTS (SELECT 1 FROM event_staff_availability a WHERE a.event_day_id = s.event_day_id AND a.staff_id = s.staff_id AND a.response = 'available'))) AS invalid_assignments,
    (SELECT count(*)::int FROM messages m JOIN users u ON u.id = m.sender_id JOIN conversations c ON c.id = m.conversation_id JOIN booking_requests b ON b.id = c.booking_request_id WHERE b.reference LIKE 'SCN-%' AND m.sender_role::text <> u.role) AS sender_mismatches,
    (SELECT count(*)::int FROM services s WHERE s.name LIKE 'Scenario Service %' AND s.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM catalog_pages p JOIN catalog_sections cs ON cs.page_id = p.id JOIN catalog_widgets w ON w.section_id = cs.id WHERE p.service_id = s.id AND w.type = 'photo')) AS services_without_photos,
    (SELECT count(*)::int FROM booking_requests b JOIN packages p ON p.id = b.package_id WHERE b.reference LIKE 'SCN-%' AND p.archived_at IS NOT NULL) AS archived_package_bookings`);
  assert.deepEqual(violations.rows[0], {
    non_customer_bookings: 0,
    range_mismatches: 0,
    days_outside_accepted: 0,
    broken_moves: 0,
    invalid_assignments: 0,
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
      count(DISTINCT s.id)::int AS sections,
      count(DISTINCT w.id) FILTER (WHERE w.type = 'markdown')::int AS markdown_widgets,
      count(DISTINCT w.id) FILTER (WHERE w.type = 'photo' AND m.source = 'sample')::int AS sample_photo_widgets
    FROM packages p
    LEFT JOIN catalog_pages cp ON cp.package_id = p.id
    LEFT JOIN catalog_sections s ON s.page_id = cp.id
    LEFT JOIN catalog_widgets w ON w.section_id = s.id
    LEFT JOIN media_assets m ON m.id = w.media_id
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
  assert.equal(
    publicPackages.filter((row: any) =>
      String(row.name).startsWith("Scenario Celebration "),
    ).length,
    80,
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
  const demoVenues = await pool.query(
    "SELECT id FROM venues WHERE name LIKE 'Demo %' ORDER BY name",
  );
  assert.equal(demoVenues.rowCount, 3);
  const initialPublicVenues = (await readAll("/venues", "venues")).filter(
    (venue: any) => demoVenues.rows.some((row) => row.id === venue.id),
  );
  assert.equal(initialPublicVenues.length, 3);
  assert.ok(
    initialPublicVenues.every(
      (venue: any) =>
        !("imageUrls" in venue) && !venue.description.includes("venue draft"),
    ),
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int AS count FROM services")).rows[0]
      .count,
    100,
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

  await pool.query(
    "UPDATE venues SET description = 'Edited description', updated_at = created_at + interval '5 seconds' WHERE id = $1",
    [demoVenues.rows[0].id],
  );
  await pool.query(
    "UPDATE venues SET name = 'Edited demo venue', updated_at = created_at + interval '5 seconds' WHERE id = $1",
    [demoVenues.rows[1].id],
  );
  await pool.query("UPDATE venues SET archived_at = now() WHERE id = $1", [
    demoVenues.rows[2].id,
  ]);
  await pool.query("UPDATE packages SET price = price + 1 WHERE id = $1", [
    grandCelebration.id,
  ]);
  const scenarioPackage = await pool.query(
    "SELECT id FROM packages WHERE name = 'Scenario Celebration 002'",
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
  // A prior version of the application could accept a sent scenario quotation.
  const historical =
    await pool.query(`SELECT q.id, q.booking_request_id, q.version, b.customer_id
    FROM quotations q JOIN booking_requests b ON b.id = q.booking_request_id
    WHERE b.reference LIKE 'SCN-%' AND q.status = 'sent' ORDER BY q.id LIMIT 1`);
  assert.equal(historical.rowCount, 1);
  const historicalQuote = historical.rows[0];
  const acceptedAt = new Date("2026-10-31T00:00:05.000Z");
  await pool.query(
    "UPDATE quotations SET status = 'accepted', accepted_at = $1 WHERE id = $2",
    [acceptedAt, historicalQuote.id],
  );
  const historicalAudit = await pool.query(
    `INSERT INTO audit_events
    (actor_id, action, entity_type, entity_id, metadata, created_at)
    VALUES ($1, 'quotation.accepted', 'quotation', $2, $3, $4) RETURNING *`,
    [
      historicalQuote.customer_id,
      historicalQuote.id,
      JSON.stringify({
        bookingRequestId: historicalQuote.booking_request_id,
        version: historicalQuote.version,
      }),
      acceptedAt,
    ],
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
  const beforeRerun = await ids();
  await runSeed();
  assert.deepEqual(await ids(), beforeRerun);
  assert.deepEqual(
    (await pool.query("SELECT * FROM quotations ORDER BY id")).rows,
    quotationsBeforeRerun.rows,
  );
  assert.deepEqual(
    (await pool.query("SELECT * FROM audit_events ORDER BY id")).rows,
    auditsBeforeRerun.rows,
  );
  const preservedAcceptance = await pool.query(
    "SELECT status, accepted_at FROM quotations WHERE id = $1",
    [historicalQuote.id],
  );
  assert.deepEqual(preservedAcceptance.rows[0], {
    status: "accepted",
    accepted_at: acceptedAt,
  });
  assert.deepEqual(
    (
      await pool.query("SELECT * FROM audit_events WHERE id = $1", [
        historicalAudit.rows[0].id,
      ])
    ).rows[0],
    historicalAudit.rows[0],
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
      await pool.query("SELECT description FROM venues WHERE id = $1", [
        demoVenues.rows[0].id,
      ])
    ).rows[0].description,
    "Edited description",
  );
  assert.equal(
    (
      await pool.query("SELECT name FROM venues WHERE id = $1", [
        demoVenues.rows[1].id,
      ])
    ).rows[0].name,
    "Edited demo venue",
  );
  assert.ok(
    (
      await pool.query("SELECT archived_at FROM venues WHERE id = $1", [
        demoVenues.rows[2].id,
      ])
    ).rows[0].archived_at,
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

  const publicVenues = { venues: await readAll("/venues", "venues") };
  assert.ok(
    publicVenues.venues.some(
      (row: any) => row.id === demoVenues.rows[0].id && !("imageUrls" in row),
    ),
  );
  assert.ok(
    publicVenues.venues.some(
      (row: any) =>
        row.id === demoVenues.rows[1].id && row.name === "Edited demo venue",
    ),
  );
  assert.ok(
    !publicVenues.venues.some((row: any) => row.id === demoVenues.rows[2].id),
  );
  const publicServices = { services: await readAll("/services", "services") };
  assert.equal(publicServices.services.length, 60);
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
  assert.equal(
    (await read("/me", scenarioAdmin)).staffRole,
    "System Administrator",
  );
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
});
