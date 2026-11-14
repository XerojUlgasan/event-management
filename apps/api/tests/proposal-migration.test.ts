import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import pg from "pg";

const migration = "20261111130000_private_packages_quotations";
const database = `proposal_migration_${randomUUID().replaceAll("-", "")}`;
const connection = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};
const admin = new pg.Pool({ ...connection, database: process.env.DB_NAME });
let pool: pg.Pool;
let customer: string, catalog: string, booking: string, conversation: string;
let quote: string;

async function snapshot() {
  const tables = [
    "packages",
    "services",
    "booking_requests",
    "booking_request_status_history",
    "events_day",
    "event_staff_availability",
    "event_staffs",
    "conversations",
    "messages",
  ];
  const result: Record<string, unknown> = {};
  for (const table of tables) {
    const omit =
      table === "packages"
        ? " - 'package_type' - 'custom_for_booking_request_id'"
        : table === "messages"
          ? " - 'quotation_id'"
          : "";
    result[table] = (
      await pool.query(
        `SELECT coalesce(jsonb_agg(row_value ORDER BY row_value->>'id'), '[]'::jsonb) AS rows FROM (SELECT to_jsonb(t)${omit} AS row_value FROM ${table} t) data`,
      )
    ).rows[0].rows;
  }
  return result;
}

before(async () => {
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new pg.Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name >= migration) break;
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }
  customer = (
    await pool.query(
      "INSERT INTO users(email,role,password_hash) VALUES ('migration-customer@example.test','customer','unused-test-identity') RETURNING id",
    )
  ).rows[0].id;
  catalog = (
    await pool.query(
      "INSERT INTO packages(name,slug,max_guests,price) VALUES ('Original catalog','original-catalog',100,1000) RETURNING id",
    )
  ).rows[0].id;
  booking = (
    await pool.query(
      `INSERT INTO booking_requests(reference,customer_id,package_id,package_name,package_price,package_max_guests,event_type,preferred_date,requested_days,time_zone,contact_name,phone_number,status,out_of_range)
    VALUES ('PRESERVE',$1,$2,'Original inquiry snapshot',900,90,'Wedding','2099-01-01',$3,'Asia/Manila','Customer','123','accepted',false) RETURNING id`,
      [
        customer,
        catalog,
        JSON.stringify([
          {
            date: "2099-01-01",
            startsAt: "2099-01-01T02:00:00.000Z",
            endsAt: "2099-01-01T04:00:00.000Z",
          },
          { date: "2099-01-03", startsAt: null, endsAt: null },
        ]),
      ],
    )
  ).rows[0].id;
  conversation = (
    await pool.query(
      "INSERT INTO conversations(customer_id,booking_request_id) VALUES ($1,$2) RETURNING id",
      [customer, booking],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO messages(conversation_id,sender_id,body) VALUES ($1,$2,'Preserved inquiry conversation')",
    [conversation, customer],
  );
  await pool.query(
    "INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES ($1,'accepted',$2)",
    [booking, customer],
  );
  await pool.query(
    "INSERT INTO events_day(booking_request_id,day,starts_at,ends_at) VALUES ($1,'2099-01-01','2099-01-01T02:00Z','2099-01-01T04:00Z')",
    [booking],
  );
  const original = await snapshot();
  await pool.query(
    await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
  );
  assert.deepEqual(
    await snapshot(),
    original,
    "migration must preserve populated inquiries, snapshots, catalog addresses, schedules and conversations",
  );
  quote = (
    await pool.query(
      "INSERT INTO quotations(booking_request_id,version,base_amount_minor,total_amount_minor,created_by,offered_package_id,offered_package_updated_at,offered_package_terms) VALUES ($1,1,10000,10000,$2,$3,now(),'{}') RETURNING id",
      [booking, customer, catalog],
    )
  ).rows[0].id;
  await pool.query(
    "UPDATE quotations SET status='accepted',sent_at=now(),accepted_at=now() WHERE id=$1",
    [quote],
  );
  await pool.query(
    "INSERT INTO audit_events(actor_id,action,entity_type,entity_id,metadata) VALUES ($1,'quotation.accepted','quotation',$2,'{}')",
    [customer, quote],
  );
  await pool.query(
    "INSERT INTO messages(conversation_id,sender_id,body,quotation_id) VALUES ($1,$2,'Quotation v1',$3)",
    [conversation, customer, quote],
  );
  const financial = (
    await pool.query(
      "SELECT to_jsonb(q) - 'offered_package_updated_at' - 'offered_package_terms' AS row FROM quotations q WHERE id=$1",
      [quote],
    )
  ).rows[0].row;
  const audit = (
    await pool.query("SELECT * FROM audit_events WHERE entity_id=$1", [quote])
  ).rows;
  const messages = (
    await pool.query(
      "SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id",
      [conversation],
    )
  ).rows;
  const beforeSimplification = await snapshot();
  await pool.query(
    await readFile(
      new URL("20261111150000_simplify_quotation_offers/migration.sql", root),
      "utf8",
    ),
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT to_jsonb(q) AS row FROM quotations q WHERE id=$1",
        [quote],
      )
    ).rows[0].row,
    financial,
  );
  assert.deepEqual(
    (await pool.query("SELECT * FROM audit_events WHERE entity_id=$1", [quote]))
      .rows,
    audit,
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id",
        [conversation],
      )
    ).rows,
    messages,
  );
  assert.deepEqual(await snapshot(), beforeSimplification);
});

after(async () => {
  await pool?.end();
  await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
  await admin.end();
});

test("populated migrations preserve inquiries, schedules, quotation finances, acceptance, audit and delivery", async () => {
  assert.equal(
    (
      await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='quotations' AND column_name IN ('offered_package_updated_at','offered_package_terms')",
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query("SELECT package_type FROM packages WHERE id=$1", [
        catalog,
      ])
    ).rows[0].package_type,
    "catalog",
  );
  assert.equal(
    (await pool.query("SELECT to_regclass('quotation_items') AS name")).rows[0]
      .name,
    null,
  );
});

test("custom ownership, original catalog relationship and title constraints are enforced", async () => {
  const custom = (
    await pool.query(
      "INSERT INTO packages(name,slug,max_guests,price,package_type,custom_for_booking_request_id,published_at) VALUES ('Original catalog',$1,120,1500,'custom',$2,NULL) RETURNING id",
      [`private:${randomUUID()}`, booking],
    )
  ).rows[0].id;
  await assert.rejects(
    pool.query(
      "INSERT INTO packages(name,slug,max_guests,price) VALUES ('ORIGINAL CATALOG','duplicate-title',100,1)",
    ),
    { code: "23505" },
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO packages(name,slug,max_guests,price,package_type,custom_for_booking_request_id,published_at) VALUES ('Other','duplicate-owner',100,1,'custom',$1,NULL)",
      [booking],
    ),
    { code: "23505" },
  );
  await assert.rejects(
    pool.query(
      "UPDATE packages SET custom_for_booking_request_id=NULL WHERE id=$1",
      [custom],
    ),
    { code: "23514" },
  );
  await assert.rejects(
    pool.query("UPDATE booking_requests SET package_id=$1 WHERE id=$2", [
      custom,
      booking,
    ]),
    { code: "23514" },
  );
  assert.equal(
    (
      await pool.query(
        "SELECT package_name FROM booking_requests WHERE id=$1",
        [booking],
      )
    ).rows[0].package_name,
    "Original inquiry snapshot",
  );
});

test("JSONB ordering and exact bounded centavo totals are enforced independently of the API", async () => {
  const items = [
    {
      id: randomUUID(),
      direction: "add",
      kind: "addition",
      description: "Extra service",
      amountMinor: 251,
      serviceId: null,
    },
    {
      id: randomUUID(),
      direction: "deduct",
      kind: "deduction",
      description: "Adjustment",
      amountMinor: 100,
    },
  ];
  await pool.query(
    "UPDATE quotations SET items=$1,total_amount_minor=10151 WHERE id=$2",
    [JSON.stringify(items), quote],
  );
  assert.deepEqual(
    (await pool.query("SELECT items FROM quotations WHERE id=$1", [quote]))
      .rows[0].items,
    items,
  );
  await assert.rejects(
    pool.query("UPDATE quotations SET total_amount_minor=1 WHERE id=$1", [
      quote,
    ]),
    { code: "23514" },
  );
  await assert.rejects(
    pool.query("UPDATE quotations SET items='{}' WHERE id=$1", [quote]),
    { code: "23514" },
  );
  await assert.rejects(
    pool.query("UPDATE quotations SET items=$1 WHERE id=$2", [
      JSON.stringify([{ ...items[0], amountMinor: 1.5 }]),
      quote,
    ]),
    { code: "23514" },
  );
  await assert.rejects(
    pool.query("UPDATE quotations SET items=$1 WHERE id=$2", [
      JSON.stringify([items[0], items[0]]),
      quote,
    ]),
    { code: "23514" },
  );
  await pool.query(
    "UPDATE quotations SET items='[]',total_amount_minor=base_amount_minor WHERE id=$1",
    [quote],
  );
});

test("a quotation message cannot be delivered into a different conversation", async () => {
  const deliveryQuote = (
    await pool.query(
      "INSERT INTO quotations(booking_request_id,version,base_amount_minor,total_amount_minor,created_by,offered_package_id) VALUES ($1,2,10000,10000,$2,$3) RETURNING id",
      [booking, customer, catalog],
    )
  ).rows[0].id;
  const general = (
    await pool.query(
      "INSERT INTO conversations(customer_id) VALUES ($1) RETURNING id",
      [customer],
    )
  ).rows[0].id;
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id,sender_id,body,quotation_id) VALUES ($1,$2,'Wrong thread',$3)",
      [general, customer, deliveryQuote],
    ),
    { code: "23514" },
  );
  await pool.query(
    "INSERT INTO messages(conversation_id,sender_id,body,quotation_id) VALUES ($1,$2,'Correct thread',$3)",
    [conversation, customer, deliveryQuote],
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id,sender_id,body,quotation_id) VALUES ($1,$2,'Duplicate delivery',$3)",
      [conversation, customer, deliveryQuote],
    ),
    { code: "23505" },
  );
});

test("new tables enable RLS and deny direct client privileges", async () => {
  const tables = ["package_services", "quotations", "audit_events"];
  const rows = await pool.query(
    "SELECT relname,relrowsecurity FROM pg_class WHERE relname=ANY($1::text[])",
    [tables],
  );
  assert.equal(rows.rowCount, 3);
  assert(rows.rows.every((row) => row.relrowsecurity));
  const roles = (
    await pool.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')",
    )
  ).rows;
  for (const { rolname } of roles) {
    for (const table of tables) {
      assert.equal(
        (
          await pool.query(
            "SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS allowed",
            [rolname, table],
          )
        ).rows[0].allowed,
        false,
      );
    }
  }
});
