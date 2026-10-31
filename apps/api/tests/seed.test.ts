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

const tables = ["users", "packages", "package_versions", "services", "service_versions", "package_services", "venues", "venue_versions", "booking_requests", "booking_request_status_history", "conversations", "messages"] as const;
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

test("seed creates connected demo records and reruns preserve edits and unrelated data", async () => {
  await runSeed();
  const coverage = await pool.query(`SELECT
    (SELECT count(*)::int FROM booking_requests WHERE reference LIKE 'DEMO-%') AS requests,
    (SELECT count(*)::int FROM conversations c JOIN users u ON u.id = c.customer_id WHERE u.email LIKE 'demo.%@clemora.example.test') AS conversations,
    (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.customer_id WHERE u.email LIKE 'demo.%@clemora.example.test') AS messages,
    (SELECT count(*)::int FROM venue_versions WHERE name LIKE 'Demo %' AND state = 'published') AS venue_published`);
  assert.deepEqual(coverage.rows[0], { requests: 10, conversations: 5, messages: 10, venue_published: 3 });
  const demoVenues = await pool.query("SELECT v.id, version.id AS version_id FROM venues v JOIN venue_versions version ON version.venue_id = v.id WHERE version.name LIKE 'Demo %' ORDER BY version.name");
  assert.equal(demoVenues.rowCount, 3);
  const initialPublicVenues = (await read("/venues")).venues.filter((venue: any) => demoVenues.rows.some((row) => row.id === venue.id));
  assert.equal(initialPublicVenues.length, 3);
  assert.ok(initialPublicVenues.every((venue: any) => venue.imageUrls.length === 0 && !venue.description.includes("venue draft")));
  const range = await pool.query("SELECT br.out_of_range, br.guest_count, pv.guest_max FROM booking_requests br JOIN package_versions pv ON pv.id = br.package_version_id WHERE br.reference = 'DEMO-002'");
  assert.equal(range.rows[0].out_of_range, true);
  assert.ok(range.rows[0].guest_count > range.rows[0].guest_max);
  const catalog = await pool.query(`SELECT p.id AS package_id, pv.id AS version_id, pv.name,
    count(ps.id)::int AS assignments, count(*) FILTER (WHERE ps.role = 'included')::int AS included,
    count(*) FILTER (WHERE ps.role = 'add_on')::int AS add_ons
    FROM packages p JOIN package_versions pv ON pv.package_id = p.id
    JOIN package_services ps ON ps.package_version_id = pv.id
    JOIN service_versions sv ON sv.id = ps.service_version_id
    JOIN services s ON s.id = sv.service_id
    WHERE pv.state = 'published' AND sv.state = 'published' AND pv.name = 'Demo Wedding Reception'
    GROUP BY p.id, pv.id, pv.name`);
  assert.equal(catalog.rowCount, 1);
  assert.deepEqual([catalog.rows[0].assignments, catalog.rows[0].included, catalog.rows[0].add_ons], [4, 2, 2]);
  const request = await pool.query(`SELECT br.id, br.customer_id, br.package_id, br.package_version_id, br.status,
    array_agg(h.status ORDER BY h.created_at) AS history
    FROM booking_requests br JOIN package_versions pv ON pv.id = br.package_version_id AND pv.package_id = br.package_id
    JOIN booking_request_status_history h ON h.booking_request_id = br.id JOIN users actor ON actor.id = h.changed_by
    WHERE br.reference = 'DEMO-003' GROUP BY br.id`);
  assert.equal(request.rowCount, 1);
  assert.equal(request.rows[0].status, "accepted");
  assert.deepEqual(request.rows[0].history, ["under_review", "accepted"]);
  const conversation = await pool.query(`SELECT c.id, c.customer_id, count(m.id)::int AS message_count,
    array_agg(u.role ORDER BY m.created_at) AS sender_roles
    FROM conversations c JOIN users customer ON customer.id = c.customer_id
    JOIN messages m ON m.conversation_id = c.id JOIN users u ON u.id = m.sender_id
    WHERE customer.email = 'demo.camille@clemora.example.test' GROUP BY c.id`);
  assert.equal(conversation.rowCount, 1);
  assert.equal(conversation.rows[0].customer_id, request.rows[0].customer_id);
  assert.equal(conversation.rows[0].message_count, 2);
  assert.deepEqual(conversation.rows[0].sender_roles, ["customer", "admin"]);

  await pool.query("UPDATE package_versions SET name = $1 WHERE id = $2", ["Edited demo package", catalog.rows[0].version_id]);
  await pool.query("UPDATE venue_versions SET state = 'draft', published_at = NULL, description = replace(description, 'venue', 'venue draft'), updated_at = created_at WHERE id = $1", [demoVenues.rows[0].version_id]);
  await pool.query("UPDATE venue_versions SET state = 'draft', published_at = NULL, name = 'Edited demo venue', updated_at = created_at + interval '5 seconds' WHERE id = $1", [demoVenues.rows[1].version_id]);
  await pool.query("UPDATE venues SET archived_at = now() WHERE id = $1", [demoVenues.rows[2].id]);
  const unrelated = await pool.query("INSERT INTO users (email, display_name, role, password_hash) VALUES ($1, $2, 'customer', 'unused') RETURNING id", ["unrelated-seed-test@example.test", "Unrelated person"]);
  const beforeRerun = await ids();
  await runSeed();
  assert.deepEqual(await ids(), beforeRerun);
  assert.equal((await pool.query("SELECT name FROM package_versions WHERE id = $1", [catalog.rows[0].version_id])).rows[0].name, "Edited demo package");
  assert.deepEqual((await pool.query("SELECT state, description FROM venue_versions WHERE id = $1", [demoVenues.rows[0].version_id])).rows[0], { state: "published", description: initialPublicVenues.find((venue: any) => venue.id === demoVenues.rows[0].id).description });
  assert.deepEqual((await pool.query("SELECT state, name FROM venue_versions WHERE id = $1", [demoVenues.rows[1].version_id])).rows[0], { state: "draft", name: "Edited demo venue" });
  assert.ok((await pool.query("SELECT archived_at FROM venues WHERE id = $1", [demoVenues.rows[2].id])).rows[0].archived_at);
  assert.equal((await pool.query("SELECT display_name FROM users WHERE id = $1", [unrelated.rows[0].id])).rows[0].display_name, "Unrelated person");

  const publicPackages = await read("/packages");
  assert.ok(publicPackages.packages.some((row: any) => row.id === catalog.rows[0].package_id && row.name === "Edited demo package"));
  const publicVenues = await read("/venues");
  assert.ok(publicVenues.venues.some((row: any) => row.id === demoVenues.rows[0].id && row.imageUrls.length === 0));
  assert.ok(!publicVenues.venues.some((row: any) => row.id === demoVenues.rows[1].id || row.id === demoVenues.rows[2].id));
  assert.ok((await read("/services")).services.length >= 4);
  const customerCookie = await login("demo.camille@clemora.example.test");
  const adminCookie = await login("demo.admin@clemora.example.test");
  assert.ok((await read("/booking-requests/mine", customerCookie)).bookingRequests.some((row: any) => row.id === request.rows[0].id));
  const customerThread = await read("/messages/conversation", customerCookie);
  assert.equal(customerThread.conversation.id, conversation.rows[0].id);
  assert.equal(customerThread.messages.length, 2);
  assert.ok((await read("/admin/booking-requests", adminCookie)).bookingRequests.some((row: any) => row.id === request.rows[0].id));
  assert.ok((await read("/admin/conversations", adminCookie)).conversations.some((row: any) => row.id === conversation.rows[0].id));
});

test("an administrator email collision does not produce requests with missing status history", async () => {
  const collisionDatabase = `em_seed_collision_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE "${collisionDatabase}"`);
  const collisionPool = new Pool({ host: process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: collisionDatabase });
  try {
    await applyMigrations(collisionPool);
    await collisionPool.query("INSERT INTO users (email, role, password_hash) VALUES ('demo.admin@clemora.example.test', 'customer', 'unused')");
    await runSeed(collisionDatabase);
    const inconsistent = await collisionPool.query(`SELECT br.reference FROM booking_requests br
      LEFT JOIN LATERAL (SELECT status FROM booking_request_status_history WHERE booking_request_id = br.id ORDER BY created_at DESC LIMIT 1) latest ON true
      WHERE br.reference LIKE 'DEMO-%' AND br.status IS DISTINCT FROM latest.status`);
    assert.equal(inconsistent.rowCount, 0);
    const managerStates = await collisionPool.query("SELECT reference FROM booking_requests WHERE status IN ('needs_details', 'accepted', 'declined')");
    assert.equal(managerStates.rowCount, 0);
  } finally {
    await collisionPool.end();
    await admin.query(`DROP DATABASE "${collisionDatabase}" WITH (FORCE)`);
  }
});
