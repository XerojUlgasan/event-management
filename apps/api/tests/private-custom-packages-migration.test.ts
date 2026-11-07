import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./helpers/drop-test-database.js";

test("private package migration preserves catalog, booking, message and quotation history and enforces ownership", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host), "Migration proof requires local PostgreSQL");
  const connection = { host, port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  const database = `em_private_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migration = "20261107180000_private_booking_packages";
    const entries = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.filter(entry => entry.name < migration)) {
      await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
    }

    const user = (await pool.query<{ id: string }>("INSERT INTO users(email,password_hash) VALUES('private-migration@example.test','unused') RETURNING id")).rows[0]!.id;
    const pkg = (await pool.query<{ id: string }>("INSERT INTO packages(name,description,max_guests,price,published_at) VALUES('Catalog original','Original terms',100,2000,'2026-01-01Z') RETURNING id")).rows[0]!.id;
    const page = (await pool.query<{ id: string }>("INSERT INTO catalog_pages(package_id) VALUES($1) RETURNING id", [pkg])).rows[0]!.id;
    const section = (await pool.query<{ id: string }>("INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'Terms',0) RETURNING id", [page])).rows[0]!.id;
    await pool.query("INSERT INTO catalog_widgets(section_id,type,sort_order,x,y,w,h,markdown) VALUES($1,'markdown',0,0,0,12,4,'Original canvas terms')", [section]);
    const bookings: string[] = [];
    for (const reference of ["PRIVATE-MIGRATION-OWNER", "PRIVATE-MIGRATION-OTHER"]) {
      const booking = await pool.query<{ id: string }>(`INSERT INTO booking_requests
        (reference,customer_id,package_id,event_type,preferred_date,estimated_duration,contact_name,phone_number,out_of_range)
        VALUES($1,$2,$3,'Wedding','2099-01-01','1_day','Migration fixture','123',false) RETURNING id`, [reference, user, pkg]);
      bookings.push(booking.rows[0]!.id);
    }
    const owner = bookings[0]!;
    const other = bookings[1]!;
    const conversation = (await pool.query<{ id: string }>("INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id", [user, owner])).rows[0]!.id;
    await pool.query("INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,'Historical discussion')", [conversation, user]);
    await pool.query("INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES($1,'under_review',$2)", [owner, user]);
    await pool.query("INSERT INTO audit_events(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'fixture.created','booking_request',$2,'{}')", [user, owner]);
    const quote = (await pool.query<{ id: string }>(`INSERT INTO quotations
      (booking_request_id,version,base_amount_minor,total_amount_minor,created_by,status,sent_at,accepted_at)
      VALUES($1,1,200000,205000,$2,'accepted','2026-02-01Z','2026-02-02Z') RETURNING id`, [owner, user])).rows[0]!.id;
    await pool.query("INSERT INTO quotation_items(quotation_id,direction,kind,description,amount_minor,sort_order) VALUES($1,'add','addition','Retained adjustment',5000,0)", [quote]);

    const beforePackage = (await pool.query("SELECT * FROM packages WHERE id=$1", [pkg])).rows[0];
    const beforeQuote = (await pool.query("SELECT * FROM quotations WHERE id=$1", [quote])).rows[0];
    const untouched = ["booking_requests", "booking_request_status_history", "conversations", "messages", "audit_events", "quotation_items", "catalog_pages", "catalog_sections", "catalog_widgets", "media_assets", "package_services"];
    const before = new Map<string, unknown[]>();
    for (const table of untouched) before.set(table, (await pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows);

    await pool.query(await readFile(new URL(`${migration}/migration.sql`, root), "utf8"));
    for (const table of untouched) assert.deepEqual((await pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows, before.get(table), `${table} data preserved`);
    assert.deepEqual((await pool.query("SELECT * FROM packages WHERE id=$1", [pkg])).rows[0], { ...beforePackage, package_type: "catalog", custom_for_booking_request_id: null });
    assert.deepEqual((await pool.query("SELECT * FROM quotations WHERE id=$1", [quote])).rows[0], {
      ...beforeQuote, offered_package_id: null, offered_package_updated_at: null, offered_package_terms: null, adjustments_reviewed: true,
    }, "Legacy terms remain unknown rather than reconstructed from today's package");

    const custom = (await pool.query<{ id: string }>(`INSERT INTO packages
      (name,max_guests,price,package_type,custom_for_booking_request_id,published_at)
      VALUES('Private offer',80,2500,'custom',$1,NULL) RETURNING id`, [owner])).rows[0]!.id;
    await pool.query("UPDATE booking_requests SET package_id=$1 WHERE id=$2", [custom, owner]);
    assert.equal((await pool.query<{ package_id: string }>("SELECT package_id FROM booking_requests WHERE id=$1", [owner])).rows[0]!.package_id, custom);
    await assert.rejects(pool.query("UPDATE booking_requests SET package_id=$1 WHERE id=$2", [custom, other]), /Custom package belongs to another booking/);
    await assert.rejects(pool.query(`INSERT INTO packages(name,max_guests,price,package_type,custom_for_booking_request_id,published_at) VALUES('Duplicate',80,2500,'custom',$1,NULL)`, [owner]), /unique constraint/);
    await assert.rejects(pool.query("UPDATE packages SET custom_for_booking_request_id=$1 WHERE id=$2", [other, custom]), /immutable/);
    await assert.rejects(pool.query("UPDATE packages SET package_type='catalog',custom_for_booking_request_id=NULL,published_at=now() WHERE id=$1", [custom]), /immutable/);
    await assert.rejects(pool.query("UPDATE packages SET package_type='custom',custom_for_booking_request_id=$1,published_at=NULL WHERE id=$2", [other, pkg]), /immutable/);
    await assert.rejects(pool.query("INSERT INTO packages(name,max_guests,price,package_type,published_at) VALUES('Missing owner',80,2500,'custom',NULL)"), /check constraint/);
    await assert.rejects(pool.query("INSERT INTO packages(name,max_guests,price,package_type,published_at) VALUES('Hidden catalog',80,2500,'catalog',NULL)"), /check constraint/);
    await assert.rejects(pool.query("INSERT INTO packages(name,max_guests,price,package_type,custom_for_booking_request_id) VALUES('Public custom',80,2500,'custom',$1)", [other]), /check constraint/);
    await assert.rejects(pool.query("INSERT INTO packages(name,max_guests,price,package_type) VALUES('Unknown type',80,2500,'other')"), /check constraint/);
    await assert.rejects(pool.query("DELETE FROM booking_requests WHERE id=$1", [owner]), /foreign key constraint/);
    await pool.query("UPDATE packages SET name='Edited private offer',price=3000 WHERE id=$1", [custom]);
    assert.deepEqual((await pool.query("SELECT name,price,published_at FROM packages WHERE id=$1", [pkg])).rows[0], { name: "Catalog original", price: 2000, published_at: new Date("2026-01-01Z") });
    assert.deepEqual((await pool.query("SELECT base_amount_minor,total_amount_minor,accepted_at,offered_package_terms FROM quotations WHERE id=$1", [quote])).rows[0], {
      base_amount_minor: 200000, total_amount_minor: 205000, accepted_at: new Date("2026-02-02Z"), offered_package_terms: null,
    });
  } finally {
    try {
      await pool?.end();
      await dropTestDatabase(admin, database);
    } finally {
      await admin.end();
    }
  }
});
