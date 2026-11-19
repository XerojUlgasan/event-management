import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

test("package reset removes booking chats before detaching requests and preserves independent data", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const name = `em_canvas_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;

  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    pool = new Pool({ ...connection, database: name });
    const root = new URL("../prisma/migrations/", import.meta.url);

    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries.filter(
      (e) => e.name < "20261102130000_package_canvas",
    ))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    const user = (
      await pool.query(
        "INSERT INTO users(email,role,password_hash) VALUES ('migration@example.test','customer','unused') RETURNING id",
      )
    ).rows[0].id;
    const pkg = (
      await pool.query("INSERT INTO packages DEFAULT VALUES RETURNING id")
    ).rows[0].id;
    const version = (
      await pool.query(
        "INSERT INTO package_versions(package_id,version,state,name,event_types,description,guest_max,inclusions,exclusions,price,published_at) VALUES ($1,1,'published','Old package',ARRAY['Wedding'],'Old offer',100,ARRAY['Setup'],ARRAY[]::text[],1000,now()) RETURNING id",
        [pkg],
      )
    ).rows[0].id;
    const booking = (
      await pool.query(
        "INSERT INTO booking_requests(reference,customer_id,package_id,package_version_id,package_name,event_type,preferred_date,time_zone,contact_name,phone_number,out_of_range) VALUES ('MIGRATION',$1,$2,$3,'Old package','Wedding','2030-01-01','Asia/Manila','Client','123',false) RETURNING id",
        [user, pkg, version],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES($1,'under_review',$2)",
      [booking, user],
    );
    const linked = (
      await pool.query(
        "INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id",
        [user, booking],
      )
    ).rows[0].id;
    const general = (
      await pool.query(
        "INSERT INTO conversations(customer_id) VALUES($1) RETURNING id",
        [user],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$3,'Booking message'),($2,$3,'General message')",
      [linked, general, user],
    );
    await pool.query("INSERT INTO services DEFAULT VALUES");
    await pool.query(
      await readFile(
        new URL("20261102130000_package_canvas/migration.sql", root),
        "utf8",
      ),
    );

    for (const table of [
      "packages",
      "booking_requests",
      "booking_request_status_history",
    ])
      assert.equal(
        Number(
          (await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
        ),
        0,
      );

    assert.equal(
      (await pool.query("SELECT body FROM messages")).rows[0].body,
      "General message",
    );
    assert.deepEqual(
      (await pool.query("SELECT id FROM conversations")).rows.map((r) => r.id),
      [general],
    );

    for (const table of ["users", "services"])
      assert.equal(
        Number(
          (await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
        ),
        1,
      );

    assert.equal(
      (await pool.query("SELECT to_regclass('package_versions') AS table_name"))
        .rows[0].table_name,
      null,
    );
    await assert.rejects(
      pool.query("INSERT INTO catalog_pages DEFAULT VALUES"),
      /catalog_pages_one_owner/,
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO media_assets(kind,source) VALUES('video','external')",
      ),
      /media_assets_source/,
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});

test("package description migration preserves existing card excerpts and independent records", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_description_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migration = "20261102170000_package_description";

    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries.filter((e) => e.name < migration))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,event_types,guest_max,price) VALUES('Existing',ARRAY['Wedding'],100,1000) RETURNING id",
      )
    ).rows[0].id;
    const empty = (
      await pool.query(
        "INSERT INTO packages(name,event_types,guest_max,price) VALUES('No canvas',ARRAY['Wedding'],100,1000) RETURNING id",
      )
    ).rows[0].id;
    const page = (
      await pool.query(
        "INSERT INTO catalog_pages(package_id) VALUES($1) RETURNING id",
        [pkg],
      )
    ).rows[0].id;
    const section = (
      await pool.query(
        "INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'',0) RETURNING id",
        [page],
      )
    ).rows[0].id;
    const markdown =
      "## A **beautiful** celebration\n\n[Details](https://example.test) ![Table](https://example.test/photo.jpg) <em>Welcome</em>\n> Enjoy.";
    await pool.query(
      "INSERT INTO catalog_widgets(section_id,type,sort_order,x,y,w,h,markdown) VALUES($1,'markdown',1,0,0,6,6,'Later text'),($1,'markdown',0,6,0,6,6,$2)",
      [section, markdown],
    );
    await pool.query("INSERT INTO services DEFAULT VALUES");
    await pool.query("INSERT INTO venues DEFAULT VALUES");
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    assert.equal(
      (await pool.query("SELECT description FROM packages WHERE id=$1", [pkg]))
        .rows[0].description,
      "A beautiful celebration Details Table Welcome Enjoy.",
    );
    assert.equal(
      (
        await pool.query("SELECT description FROM packages WHERE id=$1", [
          empty,
        ])
      ).rows[0].description,
      "",
    );
    assert.equal(
      (await pool.query("SELECT count(*) FROM packages")).rows[0].count,
      "2",
    );
    assert.equal(
      (await pool.query("SELECT count(*) FROM catalog_widgets")).rows[0].count,
      "2",
    );

    for (const table of ["services", "venues"])
      assert.equal(
        (await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
        "1",
      );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
