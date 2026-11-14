import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

test("catalog cleanup retains records, guest limits, inquiry snapshots and canvas media", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_cleanup_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migration = "20261102190000_cleanup_catalog_fields";
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.filter((e) => e.name < migration))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    const user = (
      await pool.query(
        "INSERT INTO users(email,password_hash) VALUES('cleanup@example.test','unused') RETURNING id",
      )
    ).rows[0].id;
    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,description,event_types,guest_max,price) VALUES('Package','Retained description',ARRAY['Wedding'],150,1000) RETURNING id",
      )
    ).rows[0].id;
    const venue = (
      await pool.query(
        "INSERT INTO venues(name,location,description,categories,capacity_max,image_urls) VALUES('Venue','City','Retained venue',ARRAY['Garden'],200,ARRAY['https://example.test/photo.jpg']) RETURNING id",
      )
    ).rows[0].id;
    const archivedVenue = (
      await pool.query(
        "INSERT INTO venues(name,location,description,categories,archived_at) VALUES('Archived','City','Null capacity','{}',now()) RETURNING id",
      )
    ).rows[0].id;
    const service = (
      await pool.query(
        "INSERT INTO services(name,description,hourly_rate_pesos,image_id) VALUES('Service','Retained service',500,$1) RETURNING id",
        [randomUUID()],
      )
    ).rows[0].id;
    const booking = (
      await pool.query(
        `INSERT INTO booking_requests(reference,customer_id,package_id,package_name,package_price,package_guest_max,event_type,preferred_date,time_zone,guest_count,contact_name,phone_number,out_of_range)
      VALUES('CLEANUP',$1,$2,'Original package',900,100,'Custom event','2099-01-01','Asia/Manila',120,'Customer','123',true) RETURNING id`,
        [user, pkg],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES($1,'under_review',$2)",
      [booking, user],
    );
    const conversation = (
      await pool.query(
        "INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id",
        [user, booking],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,'Preserved message')",
      [conversation, user],
    );
    const media = (
      await pool.query(
        "INSERT INTO media_assets(kind,source,storage_key,mime_type,byte_size) VALUES('image','upload','catalog-media/retained','image/png',9) RETURNING id",
      )
    ).rows[0].id;
    for (const [owner, id] of [
      ["package", pkg],
      ["venue", venue],
      ["service", service],
    ]) {
      const page = (
        await pool.query(
          `INSERT INTO catalog_pages(${owner}_id) VALUES($1) RETURNING id`,
          [id],
        )
      ).rows[0].id;
      const section = (
        await pool.query(
          "INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'Gallery',0) RETURNING id",
          [page],
        )
      ).rows[0].id;
      await pool.query(
        "INSERT INTO catalog_widgets(section_id,type,sort_order,x,y,w,h,media_id,alt,caption) VALUES($1,'photo',0,1,2,6,7,$2,'Retained alt','Retained caption')",
        [section, media],
      );
    }
    const omitted: Record<string, string[]> = {
      packages: ["event_types", "guest_max"],
      venues: ["categories", "image_urls", "capacity_max"],
      services: ["image_id"],
      booking_requests: ["package_guest_max"],
    };
    const tables = [
      "users",
      "packages",
      "venues",
      "services",
      "booking_requests",
      "booking_request_status_history",
      "conversations",
      "messages",
      "catalog_pages",
      "catalog_sections",
      "catalog_widgets",
      "media_assets",
    ];
    const before: Record<string, unknown[]> = {};
    for (const table of tables) {
      before[table] = (
        await pool.query(`SELECT * FROM ${table} ORDER BY id`)
      ).rows.map((row) => {
        if (table === "packages") row.max_guests = row.guest_max;
        if (table === "venues") row.max_guests = row.capacity_max;
        if (table === "booking_requests")
          row.package_max_guests = row.package_guest_max;
        for (const key of omitted[table] ?? []) delete row[key];
        return row;
      });
    }
    for (const entry of entries.filter((e) => e.name >= migration))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    for (const table of tables)
      assert.deepEqual(
        (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
        before[table],
        `${table} retained content`,
      );
    assert.equal(
      (
        await pool.query("SELECT max_guests FROM venues WHERE id=$1", [
          archivedVenue,
        ])
      ).rows[0].max_guests,
      null,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT package_max_guests FROM booking_requests WHERE id=$1",
          [booking],
        )
      ).rows[0].package_max_guests,
      100,
    );
    assert.ok(
      (
        await pool.query(
          "SELECT to_regclass('booking_request_status_history_booking_request_id_created_a_idx') AS name",
        )
      ).rows[0].name,
    );
    for (const [table, columns] of Object.entries(omitted)) {
      assert.equal(
        (
          await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=ANY($2::text[])",
            [table, columns],
          )
        ).rowCount,
        0,
      );
    }
    await assert.rejects(
      pool.query("UPDATE packages SET max_guests=0 WHERE id=$1", [pkg]),
      /packages_max_guests_check/,
    );
    await assert.rejects(
      pool.query("UPDATE venues SET max_guests=-1 WHERE id=$1", [venue]),
      /venues_max_guests_check/,
    );
    await assert.rejects(
      pool.query(
        "UPDATE booking_requests SET package_max_guests=0 WHERE id=$1",
        [booking],
      ),
      /booking_requests_package_max_guests_check/,
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
