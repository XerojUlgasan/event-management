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
    .filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await target.query(await readFile(new URL(`${entry.name}/migration.sql`, migrations), "utf8"));
  }
}

before(async () => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST ?? "localhost"), "Tests require local PostgreSQL");
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
    env: { ...process.env, DB_NAME: target, SEED_RANDOM_SEED: "seed-integration", SEED_CLOCK: "2026-10-31T00:00:00Z", FIREBASE_PROJECT_ID: "", FIREBASE_CLIENT_EMAIL: "", FIREBASE_PRIVATE_KEY: "", GOOGLE_APPLICATION_CREDENTIALS: "", FIREBASE_AUTH_EMULATOR_HOST: "" },
  });
}

const tables = ["users", "packages", "catalog_pages", "catalog_sections", "catalog_widgets", "media_assets", "services", "venues", "booking_requests", "booking_request_status_history", "conversations", "messages"] as const;
async function ids() {
  const snapshot: Record<string, string[]> = {};
  for (const table of tables) {
    const result = await pool.query<{ id: string }>(`SELECT id FROM ${table} ORDER BY id`);
    snapshot[table] = result.rows.map((row) => row.id);
  }
  return snapshot;
}

async function read(path: string, cookie?: string) {
  const response = await app.request(`/v1${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal(response.status, 200, `GET ${path}: ${await response.clone().text()}`);
  return response.json() as Promise<any>;
}

async function login(email: string) {
  const response = await app.request("/v1/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
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
  assert.deepEqual(coverage.rows[0], { requests: 0, conversations: 5, messages: 10, package_published: 3, venue_published: 3 });
  const packageRows = await pool.query("SELECT id, name, guest_max, price, published_at IS NOT NULL AS published FROM packages ORDER BY name");
  assert.deepEqual(packageRows.rows.map((row) => ({
    name: row.name,
    guestMax: row.guest_max,
    price: row.price,
    published: row.published,
  })), [
    { name: "The Grand Celebration", guestMax: 150, price: 185000, published: true },
    { name: "The Intimate Gathering", guestMax: 50, price: 68000, published: true },
    { name: "The Sweet Soirée", guestMax: 80, price: 95000, published: true },
  ]);
  const grandCelebration = packageRows.rows.find((row) => row.name === "The Grand Celebration");
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
    GROUP BY p.id, p.name
    ORDER BY p.name`);
  assert.equal(packagePageContent.rowCount, 3);
  assert.ok(packagePageContent.rows.every((row) => row.sections > 0 && row.markdown_widgets > 0 && row.sample_photo_widgets > 0));
  const publicPackages = (await read("/packages")).packages;
  assert.deepEqual(publicPackages.map((row: any) => row.name).sort(), [
    "The Grand Celebration", "The Intimate Gathering", "The Sweet Soirée",
  ]);
  assert.ok(publicPackages.every((pkg: any) => {
    const widgets = pkg.sections.flatMap((section: any) => section.widgets);
    return widgets.some((widget: any) => widget.type === "markdown") &&
      widgets.some((widget: any) => widget.type === "photo" && widget.media?.source === "sample");
  }));
  const demoVenues = await pool.query("SELECT id FROM venues WHERE name LIKE 'Demo %' ORDER BY name");
  assert.equal(demoVenues.rowCount, 3);
  const initialPublicVenues = (await read("/venues")).venues.filter((venue: any) => demoVenues.rows.some((row) => row.id === venue.id));
  assert.equal(initialPublicVenues.length, 3);
  assert.ok(initialPublicVenues.every((venue: any) => venue.imageUrls.length === 0 && !venue.description.includes("venue draft")));
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM services")).rows[0].count, 0);
  const conversation = await pool.query(`SELECT c.id, c.customer_id, count(m.id)::int AS message_count,
    array_agg(u.role ORDER BY m.created_at) AS sender_roles
    FROM conversations c JOIN users customer ON customer.id = c.customer_id
    JOIN messages m ON m.conversation_id = c.id JOIN users u ON u.id = m.sender_id
    WHERE customer.email = 'demo.camille@clemora.example.test' GROUP BY c.id`);
  assert.equal(conversation.rowCount, 1);
  assert.equal(conversation.rows[0].message_count, 2);
  assert.deepEqual(conversation.rows[0].sender_roles, ["customer", "admin"]);

  await pool.query("UPDATE venues SET description = 'Edited description', updated_at = created_at + interval '5 seconds' WHERE id = $1", [demoVenues.rows[0].id]);
  await pool.query("UPDATE venues SET name = 'Edited demo venue', updated_at = created_at + interval '5 seconds' WHERE id = $1", [demoVenues.rows[1].id]);
  await pool.query("UPDATE venues SET archived_at = now() WHERE id = $1", [demoVenues.rows[2].id]);
  await pool.query("UPDATE packages SET price = price + 1 WHERE id = $1", [grandCelebration.id]);
  const unrelated = await pool.query("INSERT INTO users (email, display_name, role, password_hash) VALUES ($1, $2, 'customer', 'unused') RETURNING id", ["unrelated-seed-test@example.test", "Unrelated person"]);
  const beforeRerun = await ids();
  await runSeed();
  assert.deepEqual(await ids(), beforeRerun);
  assert.equal((await pool.query("SELECT description FROM venues WHERE id = $1", [demoVenues.rows[0].id])).rows[0].description, "Edited description");
  assert.equal((await pool.query("SELECT name FROM venues WHERE id = $1", [demoVenues.rows[1].id])).rows[0].name, "Edited demo venue");
  assert.ok((await pool.query("SELECT archived_at FROM venues WHERE id = $1", [demoVenues.rows[2].id])).rows[0].archived_at);
  assert.equal((await pool.query("SELECT price FROM packages WHERE id = $1", [grandCelebration.id])).rows[0].price, 185001);
  assert.equal((await pool.query("SELECT display_name FROM users WHERE id = $1", [unrelated.rows[0].id])).rows[0].display_name, "Unrelated person");

  const publicVenues = await read("/venues");
  assert.ok(publicVenues.venues.some((row: any) => row.id === demoVenues.rows[0].id && row.imageUrls.length === 0));
  assert.ok(publicVenues.venues.some((row: any) => row.id === demoVenues.rows[1].id && row.name === "Edited demo venue"));
  assert.ok(!publicVenues.venues.some((row: any) => row.id === demoVenues.rows[2].id));
  assert.equal((await read("/services")).services.length, 0);
  const customerCookie = await login("demo.camille@clemora.example.test");
  const adminCookie = await login("demo.admin@clemora.example.test");
  assert.equal((await read("/booking-requests/mine", customerCookie)).bookingRequests.length, 0);
  const customerThread = await read("/messages/conversation", customerCookie);
  assert.equal(customerThread.conversation.id, conversation.rows[0].id);
  assert.equal(customerThread.messages.length, 2);
  assert.equal((await read("/admin/booking-requests", adminCookie)).bookingRequests.length, 0);
  assert.ok((await read("/admin/conversations", adminCookie)).conversations.some((row: any) => row.id === conversation.rows[0].id));
});
