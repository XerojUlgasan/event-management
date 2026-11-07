import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./helpers/drop-test-database.js";

test("booking simplification preserves edited details, quotation pricing and all other tables", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = { host, port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  const database = `em_booking_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migration = "20261107170000_simplify_booking_requests";
    const entries = (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.filter(e => e.name < migration)) {
      await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
    }

    const user = (await pool.query("INSERT INTO users(email,password_hash) VALUES('migration@example.test','unused') RETURNING id")).rows[0].id;
    const editor = (await pool.query("INSERT INTO users(email,password_hash) VALUES('editor@example.test','unused') RETURNING id")).rows[0].id;
    const pkg = (await pool.query("INSERT INTO packages(name,description,max_guests,price) VALUES('Current package','Catalog',100,2000) RETURNING id")).rows[0].id;
    const service = (await pool.query("INSERT INTO services(name,description,hourly_rate_pesos) VALUES('Service','Catalog',500) RETURNING id")).rows[0].id;
    await pool.query("INSERT INTO venues(name,location,description,max_guests) VALUES('Venue','City','Catalog',100)");
    await pool.query("INSERT INTO package_services(package_id,service_id,role,sort_order) VALUES($1,$2,'included',0)", [pkg, service]);
    const bookings: string[] = [];
    for (const reference of ["EDITED", "CLEARED", "NO-ARRANGEMENT"]) {
      const result = await pool.query(`INSERT INTO booking_requests
        (reference,customer_id,package_id,package_name,package_price,package_max_guests,package_inclusions_snapshot,event_type,preferred_date,estimated_duration,starts_at,ends_at,time_zone,guest_count,contact_name,phone_number,preferred_venue_location,special_requests,out_of_range,created_at,updated_at)
        VALUES($1,$2,$3,'Old package',1500,80,'[]','Wedding','2099-01-01','1_day','2099-01-01T01:00:00Z','2099-01-01T10:00:00Z','Asia/Manila',70,'Customer','123','Original venue','Customer notes',false,'2026-01-01Z','2026-02-01Z') RETURNING id`, [reference, user, pkg]);
      bookings.push(result.rows[0].id);
    }
    const [edited, cleared, untouched] = bookings;
    await pool.query(`INSERT INTO booking_arrangements
      (booking_request_id,event_type,preferred_date,estimated_duration,estimated_duration_days,starts_at,ends_at,time_zone,guest_count,preferred_venue_location,notes,updated_by,updated_at)
      VALUES($1,'Reception','2099-02-01','more_than_1_week',9,'2099-02-01T01:00:00Z','2099-02-10T01:00:00Z','Asia/Manila',90,'Edited venue','Internal notes',$3,'2026-03-01Z'),
      ($2,'Birthday','2099-03-01','undecided',NULL,NULL,NULL,'Asia/Manila',NULL,NULL,NULL,$3,'2026-01-02Z')`, [edited, cleared, editor]);
    const conversation = (await pool.query("INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id", [user, edited])).rows[0].id;
    const message = (await pool.query("INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,'Discuss changes here') RETURNING id", [conversation, user])).rows[0].id;
    await pool.query("INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES($1,'under_review',$2)", [edited, user]);
    await pool.query("INSERT INTO audit_events(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'arrangement.updated','booking_arrangement',$2,'{}')", [editor, edited]);
    const customization = (await pool.query(`INSERT INTO customization_requests
      (booking_request_id,conversation_id,message_id,type,description,requested_by,direction,amount_minor)
      VALUES($1,$2,$3,'add_inclusions','Extra service',$4,'add',20000) RETURNING id`, [edited, conversation, message, user])).rows[0].id;
    const quote = (await pool.query(`INSERT INTO quotations(booking_request_id,version,base_amount_minor,total_amount_minor,created_by)
      VALUES($1,1,150000,165000,$2) RETURNING id`, [edited, editor])).rows[0].id;
    await pool.query(`INSERT INTO quotation_items(quotation_id,direction,kind,description,amount_minor,service_id,customization_request_id,sort_order)
      VALUES($1,'add','addition','Extra service',20000,$2,$3,0),($1,'deduct','deduction','Discount',5000,NULL,NULL,1)`, [quote, service, customization]);

    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => String(row.tablename));
    const otherTables = tables.filter(table => !["booking_requests", "booking_arrangements", "customization_requests", "quotation_items"].includes(table));
    const before = new Map<string, unknown[]>();
    const definitions = new Map<string, unknown[]>();
    const definitionSql = `SELECT 'column' AS kind, column_name AS name, data_type || ':' || is_nullable || ':' || COALESCE(column_default,'') AS definition
      FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
      UNION ALL SELECT 'constraint', conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid=($1)::regclass
      UNION ALL SELECT 'index', indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY kind,name`;
    for (const table of otherTables) {
      before.set(table, (await pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows);
      definitions.set(table, (await pool.query(definitionSql, [table])).rows);
    }
    const itemsBefore = (await pool.query("SELECT * FROM quotation_items ORDER BY id")).rows.map(({ customization_request_id: _removed, ...row }) => row);
    const bookingBefore = (await pool.query("SELECT * FROM booking_requests WHERE id=$1", [untouched])).rows[0];
    const removed = ["package_name", "package_price", "package_max_guests", "package_inclusions_snapshot", "time_zone"];
    for (const column of removed) delete bookingBefore[column];

    await pool.query(await readFile(new URL(`${migration}/migration.sql`, root), "utf8"));
    assert.deepEqual((await pool.query("SELECT to_regclass('booking_arrangements') AS arrangements, to_regclass('customization_requests') AS customizations")).rows[0], { arrangements: null, customizations: null });
    assert.equal((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='booking_requests' AND column_name=ANY($1::text[])", [removed])).rowCount, 0);
    assert.deepEqual((await pool.query("SELECT * FROM quotation_items ORDER BY id")).rows, itemsBefore);
    assert.equal((await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='quotation_items' AND column_name='customization_request_id'")).rowCount, 0);
    assert.equal((await pool.query("SELECT to_regclass('quotation_items_customization_idx') AS name")).rows[0].name, null);
    for (const table of otherTables) {
      assert.deepEqual((await pool.query(`SELECT * FROM "${table}" ORDER BY id`)).rows, before.get(table), `${table} rows unchanged`);
      assert.deepEqual((await pool.query(definitionSql, [table])).rows, definitions.get(table), `${table} schema unchanged`);
    }
    const migrated = (await pool.query(`SELECT event_type,preferred_date,estimated_duration,estimated_duration_days,starts_at,ends_at,guest_count,preferred_venue_location,notes,updated_by,updated_at,special_requests,package_id FROM booking_requests WHERE id=$1`, [edited])).rows[0];
    assert.deepEqual(migrated, {
      event_type: "Reception", preferred_date: "2099-02-01", estimated_duration: "more_than_1_week", estimated_duration_days: 9,
      starts_at: new Date("2099-02-01T01:00:00Z"), ends_at: new Date("2099-02-10T01:00:00Z"), guest_count: 90,
      preferred_venue_location: "Edited venue", notes: "Internal notes", updated_by: editor, updated_at: new Date("2026-03-01Z"), special_requests: "Customer notes", package_id: pkg,
    });
    assert.deepEqual((await pool.query("SELECT guest_count,starts_at,ends_at,preferred_venue_location,notes,updated_at FROM booking_requests WHERE id=$1", [cleared])).rows[0], {
      guest_count: null, starts_at: null, ends_at: null, preferred_venue_location: null, notes: null, updated_at: new Date("2026-02-01Z"),
    });
    assert.deepEqual((await pool.query("SELECT * FROM booking_requests WHERE id=$1", [untouched])).rows[0], { ...bookingBefore, notes: null, updated_by: null });
    assert.equal((await pool.query(`SELECT q.base_amount_minor + SUM(CASE i.direction WHEN 'add' THEN i.amount_minor ELSE -i.amount_minor END) AS total
      FROM quotations q JOIN quotation_items i ON i.quotation_id=q.id WHERE q.id=$1 GROUP BY q.id`, [quote])).rows[0].total, "165000");
    await pool.query("UPDATE packages SET name='Latest name',price=3000 WHERE id=$1", [pkg]);
    assert.deepEqual((await pool.query("SELECT p.name,p.price FROM booking_requests b JOIN packages p ON p.id=b.package_id WHERE b.id=$1", [edited])).rows[0], { name: "Latest name", price: 3000 });
    await assert.rejects(pool.query("DELETE FROM packages WHERE id=$1", [pkg]), /foreign key constraint/);
    await assert.rejects(pool.query("DELETE FROM users WHERE id=$1", [editor]), /foreign key constraint/);
    await assert.rejects(pool.query("UPDATE quotation_items SET amount_minor=0 WHERE quotation_id=$1", [quote]), /check constraint/);
  } finally {
    try {
      await pool?.end();
      await dropTestDatabase(admin, database);
    } finally {
      await admin.end();
    }
  }
});
