import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const legacyActiveId = "b1000000-0000-0000-0000-000000000001";
const legacyArchivedId = "b1000000-0000-0000-0000-000000000002";
const legacyCreatedAt = "2026-01-01T00:00:00.000Z";
const legacyUpdatedAt = "2026-02-02T00:00:00.000Z";
const database = `em_venues_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let staffCookie: string;
let undesignatedAdminCookie: string;
let customerCookie: string;

before(async () => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST ?? "localhost"), "Tests require local PostgreSQL");
  const connection = { host: process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "20261030110000_version_venues") {
      await pool.query("INSERT INTO venues (id, name, location, description, created_at, updated_at, archived_at) VALUES ($1,'Legacy active','Original location','Original description',$3,$4,NULL), ($2,'Legacy archived','Archived location','Archived description',$3,$4,$4)", [legacyActiveId, legacyArchivedId, legacyCreatedAt, legacyUpdatedAt]);
    }
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  }
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string, staffRole: string | null = null) {
    const token = randomUUID();
    const user = await db.insertInto("users").values({ email: `${role}-${randomUUID()}@example.test`, password_hash: "unused", role, staff_role: staffRole }).returning("id").executeTakeFirstOrThrow();
    await db.insertInto("sessions").values({ user_id: user.id, token_hash: hashSessionToken(token), expires_at: new Date(Date.now() + 3600000) }).execute();
    return `em_session=${token}`;
  }
  adminCookie = await session("admin", "System Administrator");
  undesignatedAdminCookie = await session("admin");
  staffCookie = await session("staff", "Waiter");
  customerCookie = await session("customer");
});
after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    // pg-pool may resolve end() before every idle socket has disconnected.
    // Wait for disconnects instead of forcibly terminating those sockets.
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1", [database]);
      if (active.rows[0].count === 0) break;
      await delay(10);
    }
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
function call(path: string, method = "GET", body?: unknown, cookie?: string, origin?: string) {
  return app.request(`/v1${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return status === 204 ? null : response.headers.get("Content-Type")?.startsWith("image/") ? response.arrayBuffer() : response.json();
}

const content = { name: "  Garden  ", location: "  City  ", description: "  Venue description  ", categories: [" Garden "], capacityMin: 30, capacityMax: 100, imageUrls: [] as string[] };
const photo = (name: string) => `https://images.example.test/${name}.jpg`;

test("migration preserves legacy content, IDs, dates and archived visibility", async () => {
  const active = await read(await call(`/venues/${legacyActiveId}`), 200);
  assert.equal(active.id, legacyActiveId); assert.equal(active.name, "Legacy active");
  assert.equal(active.location, "Original location"); assert.equal(active.description, "Original description");
  assert.equal(active.createdAt, legacyCreatedAt); assert.equal(active.updatedAt, legacyUpdatedAt); assert.equal(active.archivedAt, null);
  assert.equal(active.publishedAt, legacyCreatedAt); assert.equal(active.capacityMin, null); assert.deepEqual(active.categories, []); assert.deepEqual(active.imageUrls, []);
  const stored = await pool.query("SELECT v.created_at, v.updated_at, p.created_at AS parent_created_at, p.updated_at AS parent_updated_at FROM venue_versions v JOIN venues p ON p.id=v.venue_id WHERE p.id=$1",[legacyActiveId]);
  assert.equal(stored.rows[0].created_at.toISOString(), legacyCreatedAt); assert.equal(stored.rows[0].updated_at.toISOString(), legacyUpdatedAt);
  assert.equal(stored.rows[0].parent_created_at.toISOString(), legacyCreatedAt); assert.equal(stored.rows[0].parent_updated_at.toISOString(), legacyUpdatedAt);
  await read(await call(`/venues/${legacyArchivedId}`),404);
  const archived = await read(await call(`/admin/venues/${legacyArchivedId}`,"GET",undefined,adminCookie),200);
  assert.equal(archived.published.name,"Legacy archived"); assert.equal(archived.archivedAt,legacyUpdatedAt);
  assert.ok(!(await read(await call("/venues"),200)).venues.some((v:any)=>v.id===legacyArchivedId));
  for (const id of [legacyActiveId,legacyArchivedId]) await read(await call(`/admin/venues/${id}/draft`,"DELETE",undefined,adminCookie),409);
});

test("venue catalog protects every administrative operation and validates inputs", async () => {
  const routes: [string,string,unknown?][] = [
    ["/admin/venues","GET"], [`/admin/venues/${legacyActiveId}`,"GET"], ["/admin/venues","POST",content],
    [`/admin/venues/${legacyActiveId}/draft`,"PATCH",{...content,expectedUpdatedAt:legacyUpdatedAt}],
    [`/admin/venues/${legacyActiveId}/publish`,"POST",{expectedUpdatedAt:legacyUpdatedAt}],
    [`/admin/venues/${legacyActiveId}/archive`,"POST"], [`/admin/venues/${legacyActiveId}`,"DELETE"], [`/admin/venues/${legacyActiveId}/draft`,"DELETE"],
    [`/admin/venues/${legacyActiveId}`,"PATCH",{name:"Old client",location:"City",description:"Description"}],
  ];
  for (const [path,method,body] of routes) {
    await read(await call(path,method,body),401);
    for (const cookie of [staffCookie,customerCookie,undesignatedAdminCookie]) await read(await call(path,method,body,cookie),403);
  }
  for (const invalid of [
    {...content,capacityMin:0}, {...content,capacityMax:1.5}, {...content,capacityMin:101},
    {...content,categories:["garden"," Garden "]}, {...content,imageUrls:["http://example.test/image.png"]},
    {...content,imageUrls:Array(11).fill(photo("excess"))},
    {...content,imageUrls:[`/v1/venue-images/${randomUUID()}`]},
  ]) await read(await call("/admin/venues","POST",invalid,adminCookie),400);
  await read(await call("/venues/not-a-uuid"),400);
  await read(await call("/venues?limit=16"),400);
  await read(await call("/venues?offset=-1"),400);
  await read(await call("/admin/venues","POST",content,adminCookie,"https://untrusted.example"),403);
  const oldEdit = await read(await call(`/admin/venues/${legacyActiveId}`,"PATCH",{name:"Old client",location:"City",description:"Description"},adminCookie),409);
  assert.match(oldEdit.error,/versioned drafts/);
});

test("draft publication requires capacity, protects snapshots and stale edits", async () => {
  let created = await read(await call("/admin/venues","POST",{...content,capacityMin:null,capacityMax:null},adminCookie),201);
  const path = `/admin/venues/${created.id}`;
  assert.equal(created.draft.name,"Garden"); assert.equal(created.draft.location,"City"); assert.deepEqual(created.draft.categories,["Garden"]);
  await read(await call(`/venues/${created.id}`),404);
  await read(await call(`${path}/publish`,"POST",{expectedUpdatedAt:created.draft.updatedAt},adminCookie),400);
  const firstPhoto = photo("first"); const secondPhoto = photo("second");
  let edited = await read(await call(`${path}/draft`,"PATCH",{...content,capacityMin:null,capacityMax:null,imageUrls:[firstPhoto],expectedUpdatedAt:created.draft.updatedAt},adminCookie),200);
  await read(await call(`${path}/publish`,"POST",{expectedUpdatedAt:edited.draft.updatedAt},adminCookie),400);
  edited = await read(await call(`${path}/draft`,"PATCH",{...content,imageUrls:[],expectedUpdatedAt:edited.draft.updatedAt},adminCookie),200);
  const thirdPhoto = photo("third");
  edited = await read(await call(`${path}/draft`,"PATCH",{...content,imageUrls:[thirdPhoto,secondPhoto],expectedUpdatedAt:edited.draft.updatedAt},adminCookie),200);
  await read(await call(`${path}/draft`,"PATCH",{...content,expectedUpdatedAt:created.draft.updatedAt},adminCookie),409);
  await read(await call(`${path}/publish`,"POST",{expectedUpdatedAt:created.draft.updatedAt},adminCookie),409);
  const published = await read(await call(`${path}/publish`,"POST",{expectedUpdatedAt:edited.draft.updatedAt},adminCookie),200);
  assert.equal(published.draft,null); assert.deepEqual(published.published.imageUrls,[thirdPhoto,secondPhoto]);
  assert.deepEqual((await read(await call(`/venues/${created.id}`),200)).imageUrls,[thirdPhoto,secondPhoto]);
  const replacementPhoto = photo("replacement");
  let replacement = await read(await call(`${path}/draft`,"PATCH",{...content,name:"Changed",imageUrls:[replacementPhoto],expectedUpdatedAt:published.published.updatedAt},adminCookie),200);
  assert.equal(replacement.draft.version,2);
  assert.equal((await read(await call(`/venues/${created.id}`),200)).name,"Garden");
  replacement = await read(await call(`${path}/publish`,"POST",{expectedUpdatedAt:replacement.draft.updatedAt},adminCookie),200);
  const history = replacement.versions.find((v:any)=>v.version===1);
  assert.equal(history.state,"superseded"); assert.deepEqual(history.imageUrls,[thirdPhoto,secondPhoto]);
  await read(await call(`${path}/archive`,"POST",undefined,adminCookie),200);
  await read(await call(`/venues/${created.id}`),404);
  await read(await call(`${path}/draft`,"PATCH",{...content,expectedUpdatedAt:replacement.published.updatedAt},adminCookie),409);
  await read(await call(`${path}/publish`,"POST",{expectedUpdatedAt:replacement.published.updatedAt},adminCookie),409);
  await read(await call(`${path}/draft`,"DELETE",undefined,adminCookie),409);
});

test("complete venue drafts publish and stay public without photos", async () => {
  const created = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  assert.deepEqual(created.draft.imageUrls, []);
  const published = await read(await call(`/admin/venues/${created.id}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  assert.equal(published.draft, null);
  assert.deepEqual(published.published.imageUrls, []);
  const publicVenue = await read(await call(`/venues/${created.id}`), 200);
  assert.deepEqual(publicVenue.imageUrls, []);
  assert.ok((await read(await call("/venues"), 200)).venues.some((venue: any) => venue.id === created.id));
});

test("venue photo URLs keep order and reject duplicates", async () => {
  const first = photo("cover"), second = photo("detail");
  await read(await call("/admin/venues", "POST", { ...content, imageUrls: [first, first] }, adminCookie), 400);
  const draft = await read(await call("/admin/venues", "POST", { ...content, imageUrls: [first, second] }, adminCookie), 201);
  assert.deepEqual(draft.draft.imageUrls, [first, second]);
  const published = await read(await call(`/admin/venues/${draft.id}/publish`, "POST", { expectedUpdatedAt: draft.draft.updatedAt }, adminCookie), 200);
  assert.deepEqual(published.published.imageUrls, [first, second]);
  assert.deepEqual((await read(await call(`/venues/${draft.id}`), 200)).imageUrls, [first, second]);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.equal(spec.paths["/v1/admin/venue-images"], undefined);
});

test("legacy DELETE endpoint archives a draft instead of deleting it", async () => {
  const draft = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  const archived = await read(await call(`/admin/venues/${draft.id}`, "DELETE", undefined, adminCookie), 200);
  assert.ok(archived.archivedAt);
  assert.equal(archived.draft.id, draft.draft.id);
  const saved = await read(await call(`/admin/venues/${draft.id}`, "GET", undefined, adminCookie), 200);
  assert.equal(saved.draft.name, "Garden");
});

test("public pagination is stable and only returns published nonarchived venues; OpenAPI matches", async () => {
  for(let i=0;i<17;i++) {
    const venue = await db.insertInto("venues").defaultValues().returning("id").executeTakeFirstOrThrow();
    await db.insertInto("venue_versions").values({venue_id:venue.id,version:1,state:"published",name:`Pagination ${String(i).padStart(2,"0")}`,location:"Demo",description:"Demo",published_at:new Date()}).execute();
  }
  const all = (await read(await call("/venues"),200)).venues;
  const first = await read(await call("/venues?limit=15&offset=0"),200);
  const second = await read(await call(`/venues?limit=15&offset=${first.nextOffset}`),200);
  assert.equal(first.venues.length,15); assert.equal(first.nextOffset,15); assert.equal(second.nextOffset,null);
  assert.deepEqual([...first.venues,...second.venues].map((v:any)=>v.id),all.map((v:any)=>v.id));
  assert.ok((await read(await call("/admin/venues","GET",undefined,adminCookie),200)).venues.some((v:any)=>v.id===legacyArchivedId));
  const spec = await (await app.request("/openapi.json")).json() as any;
  for(const path of ["/v1/venues","/v1/admin/venues/{id}/draft","/v1/admin/venues/{id}/publish","/v1/admin/venues/{id}/archive"]) assert.ok(spec.paths[path]);
  assert.ok(spec.paths["/v1/admin/venues/{id}"].delete);
  assert.ok(spec.paths["/v1/admin/venues/{id}/draft"].delete);
  assert.ok(spec.paths["/v1/admin/venues/{id}"].patch);
});

test("concurrent draft edits preserve one winner and database constraints reject inconsistent state", async () => {
  const draft = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  const path = `/admin/venues/${draft.id}/draft`;
  const responses = await Promise.all(["First", "Second"].map(name => call(path, "PATCH", {...content, name, expectedUpdatedAt: draft.draft.updatedAt}, adminCookie)));
  assert.deepEqual(responses.map(response => response.status).sort(), [200,409]);
  for (const response of responses) await response.text();
  const saved = await read(await call(`/admin/venues/${draft.id}`, "GET", undefined, adminCookie), 200);
  assert.ok(["First", "Second"].includes(saved.draft.name)); assert.equal(saved.versions.length,1);
  await assert.rejects(pool.query("UPDATE venue_versions SET published_at = now() WHERE id = $1", [saved.draft.id]), (cause: any) => cause.code === "23514");

});

test("seed reruns preserve legacy archived venues and edited new drafts", async () => {
  const runSeed = () => promisify(execFile)(process.execPath,["--import","tsx","src/db/seed.ts"],{cwd:fileURLToPath(new URL("../",import.meta.url)),env:{...process.env,FIREBASE_PROJECT_ID:"",FIREBASE_CLIENT_EMAIL:"",FIREBASE_PRIVATE_KEY:"",GOOGLE_APPLICATION_CREDENTIALS:""}});
  await runSeed();
  const id = "b1000000-0000-0000-0000-000000000003";
  let row = await read(await call(`/admin/venues/${id}`,"GET",undefined,adminCookie),200);
  assert.equal(row.published,null); assert.equal(row.draft.state,"draft");
  row = await read(await call(`/admin/venues/${id}/draft`,"PATCH",{...content,name:"Edited fixture",expectedUpdatedAt:row.draft.updatedAt},adminCookie),200);
  await call(`/admin/venues/${id}/archive`,"POST",undefined,adminCookie);
  await runSeed();
  const saved = await read(await call(`/admin/venues/${id}`,"GET",undefined,adminCookie),200);
  assert.equal(saved.draft.name,"Edited fixture"); assert.ok(saved.archivedAt); assert.equal(saved.versions.length,1);
  const legacy = await read(await call(`/admin/venues/${legacyArchivedId}`,"GET",undefined,adminCookie),200);
  assert.equal(legacy.published.name,"Legacy archived"); assert.equal(legacy.archivedAt,legacyUpdatedAt);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM venues WHERE id::text LIKE 'b1000000-0000-0000-0000-0000000000%'")).rows[0].count,15);
});
