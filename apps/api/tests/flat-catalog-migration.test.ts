import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

test("flat catalog migration keeps published content and canvases, archives drafts, and removes version storage", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = { host, port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  const database = `em_flat_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migration = "20261102180000_flat_services_venues";
    const entries = (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.filter(e => e.name < migration)) await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
    const createdAt = "2026-10-01T00:00:00.000Z";
    const updatedAt = "2026-10-05T00:00:00.000Z";
    const legacyImage = randomUUID();
    const service = (await pool.query("INSERT INTO services(created_at,updated_at) VALUES($1,$2) RETURNING id", [createdAt, updatedAt])).rows[0].id;
    const publishedService = (await pool.query(`INSERT INTO service_versions(service_id,version,state,name,description,hourly_rate_pesos,image_id,published_at,updated_at)
      VALUES($1,1,'published','Published service','Public description',500,$2,$3,$3) RETURNING id`, [service, legacyImage, updatedAt])).rows[0].id;
    const draftService = (await pool.query(`INSERT INTO service_versions(service_id,version,state,name,description,hourly_rate_pesos)
      VALUES($1,2,'draft','Unpublished service edit','Draft description',900) RETURNING id`, [service])).rows[0].id;
    const draftOnlyService = (await pool.query("INSERT INTO services DEFAULT VALUES RETURNING id")).rows[0].id;
    await pool.query("INSERT INTO service_versions(service_id,version,state,name,description) VALUES($1,1,'draft','Unpublished service','Retain incomplete details')", [draftOnlyService]);
    const venue = (await pool.query("INSERT INTO venues(created_at,updated_at) VALUES($1,$2) RETURNING id", [createdAt, updatedAt])).rows[0].id;
    const publishedVenue = (await pool.query(`INSERT INTO venue_versions(venue_id,version,state,name,location,description,categories,capacity_max,image_urls,published_at,updated_at)
      VALUES($1,1,'published','Published venue','City','Venue description',ARRAY['Garden'],100,ARRAY['https://example.test/photo.jpg'],$2,$2) RETURNING id`, [venue, updatedAt])).rows[0].id;
    const draftVenue = (await pool.query(`INSERT INTO venue_versions(venue_id,version,state,name,location,description,categories)
      VALUES($1,2,'draft','Unpublished venue edit','Draft city','Draft description',ARRAY['Indoor']) RETURNING id`, [venue])).rows[0].id;
    const archivedVenue = (await pool.query("INSERT INTO venues(archived_at) VALUES($1) RETURNING id", [updatedAt])).rows[0].id;
    await pool.query(`INSERT INTO venue_versions(venue_id,version,state,name,location,description,categories,published_at)
      VALUES($1,1,'published','Archived venue','City','Retained archive','{}',$2)`, [archivedVenue, updatedAt]);
    const draftOnlyVenue = (await pool.query("INSERT INTO venues DEFAULT VALUES RETURNING id")).rows[0].id;
    const latestDraft = (await pool.query(`INSERT INTO venue_versions(venue_id,version,state,name,location,description,categories,published_at)
      VALUES($1,1,'superseded','Old venue','City','Old details','{}',$2),($1,2,'draft','Latest venue draft','City','Retained draft','{}',NULL) RETURNING id`, [draftOnlyVenue, updatedAt])).rows[1].id;
    const emptyVenue = (await pool.query("INSERT INTO venues DEFAULT VALUES RETURNING id")).rows[0].id;
    const pkg = (await pool.query("INSERT INTO packages(name,description,event_types,guest_max,price) VALUES('Package','Keep package',ARRAY['Wedding'],50,1000) RETURNING id")).rows[0].id;
    const sampleMedia = (await pool.query("INSERT INTO media_assets(kind,source,url) VALUES('image','sample','/images/wedding.jpg') RETURNING id")).rows[0].id;
    const uploadedMedia = (await pool.query("INSERT INTO media_assets(kind,source,storage_key,mime_type,byte_size) VALUES('video','upload','migration-video','video/mp4',100) RETURNING id")).rows[0].id;
    async function page(owner: "service" | "venue" | "package", id: string, versionId: string | null, text: string, video = false) {
      const ownerColumns = owner === "package" ? "package_id" : `${owner}_id,${owner}_version_id`;
      const values = owner === "package" ? "$1" : "$1,$2";
      const params = owner === "package" ? [id] : [id, versionId];
      const p = (await pool!.query(`INSERT INTO catalog_pages(${ownerColumns}) VALUES(${values}) RETURNING id`, params)).rows[0].id;
      const s = (await pool!.query("INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'Details',0) RETURNING id", [p])).rows[0].id;
      const w = (await pool!.query(`INSERT INTO catalog_widgets(section_id,type,sort_order,x,y,w,h,markdown,media_id,alt,caption,autoplay)
        VALUES($1,'markdown',0,0,0,6,7,$2,NULL,'','',false),($1,$3,1,6,0,6,7,'',$4,'Media description','Media caption',$5) RETURNING id`, [s, text, video ? "video" : "photo", video ? uploadedMedia : sampleMedia, video])).rows.map(r => r.id);
      return { p, s, w };
    }
    const servicePage = await page("service", service, publishedService, "Public service canvas", true);
    const obsoleteServicePage = await page("service", service, draftService, "Draft service canvas");
    const venuePage = await page("venue", venue, publishedVenue, "Public venue canvas");
    const obsoleteVenuePage = await page("venue", venue, draftVenue, "Draft venue canvas");
    const retainedDraftPage = await page("venue", draftOnlyVenue, latestDraft, "Preserved archived draft");
    const packagePage = await page("package", pkg, null, "Package canvas");
    await pool.query(await readFile(new URL(`${migration}/migration.sql`, root), "utf8"));

    const serviceRow = (await pool.query("SELECT * FROM services WHERE id=$1", [service])).rows[0];
    assert.equal(serviceRow.name, "Published service");
    assert.equal(serviceRow.description, "Public description");
    assert.equal(serviceRow.hourly_rate_pesos, 500);
    assert.equal(serviceRow.image_id, legacyImage);
    assert.equal(serviceRow.archived_at, null);
    assert.equal(serviceRow.created_at.toISOString(), createdAt);
    assert.equal(serviceRow.updated_at.toISOString(), updatedAt);
    assert.equal(serviceRow.published_at.toISOString(), updatedAt);
    const venueRow = (await pool.query("SELECT * FROM venues WHERE id=$1", [venue])).rows[0];
    assert.equal(venueRow.name, "Published venue");
    assert.equal(venueRow.capacity_max, 100);
    assert.deepEqual(venueRow.categories, ["Garden"]);
    assert.deepEqual(venueRow.image_urls, ["https://example.test/photo.jpg"]);
    assert.equal(venueRow.archived_at, null);
    assert.equal((await pool.query("SELECT archived_at FROM venues WHERE id=$1", [archivedVenue])).rows[0].archived_at.toISOString(), updatedAt);
    const retainedVenue = (await pool.query("SELECT * FROM venues WHERE id=$1", [draftOnlyVenue])).rows[0];
    assert.equal(retainedVenue.name, "Latest venue draft");
    assert.ok(retainedVenue.archived_at);
    assert.equal(retainedVenue.capacity_max, null);
    assert.ok((await pool.query("SELECT archived_at FROM services WHERE id=$1", [draftOnlyService])).rows[0].archived_at);
    assert.ok((await pool.query("SELECT archived_at FROM venues WHERE id=$1", [emptyVenue])).rows[0].archived_at);
    const pages = (await pool.query("SELECT id FROM catalog_pages ORDER BY id")).rows.map(r => r.id);
    assert.deepEqual(pages, [servicePage.p, venuePage.p, retainedDraftPage.p, packagePage.p].sort());
    assert.ok(!pages.includes(obsoleteServicePage.p) && !pages.includes(obsoleteVenuePage.p));
    assert.deepEqual((await pool.query("SELECT id FROM catalog_widgets WHERE section_id=$1 ORDER BY sort_order", [servicePage.s])).rows.map(r => r.id), servicePage.w);
    assert.deepEqual((await pool.query("SELECT x,y,w,h,alt,caption,autoplay,media_id FROM catalog_widgets WHERE id=$1", [servicePage.w[1]])).rows[0], { x: 6, y: 0, w: 6, h: 7, alt: "Media description", caption: "Media caption", autoplay: true, media_id: uploadedMedia });
    assert.equal((await pool.query("SELECT count(*) FROM media_assets")).rows[0].count, "2");
    assert.equal((await pool.query("SELECT description FROM packages WHERE id=$1", [pkg])).rows[0].description, "Keep package");
    for (const name of ["service_versions", "venue_versions"]) assert.equal((await pool.query("SELECT to_regclass($1) AS name", [name])).rows[0].name, null);
    assert.equal((await pool.query("SELECT count(*) FROM information_schema.columns WHERE table_name='catalog_pages' AND column_name IN ('service_version_id','venue_version_id')")).rows[0].count, "0");
    await assert.rejects(pool.query("INSERT INTO catalog_pages(service_id) VALUES($1)", [service]), /catalog_pages_service_id_key/);
    await assert.rejects(pool.query("INSERT INTO catalog_pages(service_id,venue_id) VALUES($1,$2)", [draftOnlyService, emptyVenue]), /catalog_pages_one_owner/);
    await pool.query("DELETE FROM services WHERE id=$1", [service]);
    assert.equal((await pool.query("SELECT count(*) FROM catalog_pages WHERE id=$1", [servicePage.p])).rows[0].count, "0");
    assert.equal((await pool.query("SELECT count(*) FROM media_assets WHERE id=$1", [uploadedMedia])).rows[0].count, "1");
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
