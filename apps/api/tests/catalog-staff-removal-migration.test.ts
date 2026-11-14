import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

test("removal preserves account/history/task data, revokes obsolete access, and cleans only venue canvases", async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
  );
  const database = `em_removal_test_${randomUUID().replaceAll("-", "")}`;
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.filter(
      (e) => e.name < "20261114000000_drop_venues",
    ))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    const users = await pool.query<{
      id: string;
      email: string;
    }>(`INSERT INTO users(email,role,staff_role,password_hash) VALUES
      ('designated@example.test','admin','System Administrator','unused'),
      ('staff@example.test','staff','Coordinator','unused'),
      ('other-title@example.test','admin','Waiter','unused'),
      ('null-title@example.test','admin',NULL,'unused'),
      ('case-title@example.test','admin','system administrator','unused'),
      ('customer@example.test','customer',NULL,'unused') RETURNING id,email`);
    const id = (email: string) => {
      const user = users.rows.find((row) => row.email === email);
      assert.ok(user);
      return user.id;
    };
    for (const user of users.rows)
      await pool.query(
        "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",
        [user.id, randomUUID()],
      );
    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Retained package','retained-package',100,1000) RETURNING id",
      )
    ).rows[0].id;
    const service = (
      await pool.query(
        "INSERT INTO services(name,slug,description) VALUES('Retained service','retained-service','Description') RETURNING id",
      )
    ).rows[0].id;
    const venue = (
      await pool.query(
        "INSERT INTO venues(name,slug,description,location) VALUES('Removed venue','removed-venue','Description','City') RETURNING id",
      )
    ).rows[0].id;
    const media = (
      await pool.query(
        "INSERT INTO media_assets(kind,source,url,created_at) VALUES('image','sample','/images/wedding.jpg',now()-interval '2 days') RETURNING id",
      )
    ).rows[0].id;
    const exclusiveMedia = (
      await pool.query(
        "INSERT INTO media_assets(kind,source,url,created_at) VALUES('image','sample','/images/dinner.jpg',now()-interval '2 days') RETURNING id",
      )
    ).rows[0].id;
    const pages = await pool.query<{ id: string; venue_id: string | null }>(
      "INSERT INTO catalog_pages(package_id,service_id,venue_id) VALUES($1,NULL,NULL),(NULL,$2,NULL),(NULL,NULL,$3) RETURNING id,venue_id",
      [pkg, service, venue],
    );
    for (const page of pages.rows) {
      const section = (
        await pool.query(
          "INSERT INTO catalog_sections(page_id,sort_order) VALUES($1,0) RETURNING id",
          [page.id],
        )
      ).rows[0].id;
      await pool.query(
        "INSERT INTO catalog_widgets(section_id,type,sort_order,x,y,w,h,media_id) VALUES($1,'photo',0,0,0,6,6,$2)",
        [section, media],
      );
      if (page.venue_id)
        await pool.query(
          "INSERT INTO catalog_widgets(section_id,type,sort_order,x,y,w,h,media_id) VALUES($1,'photo',1,6,0,6,6,$2)",
          [section, exclusiveMedia],
        );
    }
    const booking = (
      await pool.query(
        `INSERT INTO booking_requests(reference,customer_id,package_id,package_name,package_price,package_max_guests,event_type,preferred_date,time_zone,contact_name,phone_number,out_of_range,status)
      VALUES('RETAINED',$1,$2,'Retained package',1000,100,'Wedding','2027-01-01','Asia/Manila','Customer','00000000000',false,'accepted') RETURNING id`,
        [id("customer@example.test"), pkg],
      )
    ).rows[0].id;
    const day = (
      await pool.query(
        "INSERT INTO events_day(booking_request_id,day,starts_at,ends_at,staffing_status) VALUES($1,'2027-01-01','2027-01-01T01:00Z','2027-01-01T02:00Z','closed') RETURNING id",
        [booking],
      )
    ).rows[0].id;
    const tasks = {
      tasks: [
        {
          id: randomUUID(),
          title: "Retained task",
          instructions: "Keep",
          startsAt: "2027-01-01T01:00:00Z",
          endsAt: "2027-01-01T02:00:00Z",
          status: "pending",
          note: "",
          completedAt: null,
        },
      ],
    };
    const checklist = (
      await pool.query(
        "INSERT INTO event_checklists(event_day_id,title,coordinator_id,sent_by,sent_at,content,revision,created_by,updated_by) VALUES($1,'Retained tasks',$2,$3,now(),$4::jsonb,7,$3,$2) RETURNING id",
        [
          day,
          id("staff@example.test"),
          id("designated@example.test"),
          JSON.stringify(tasks),
        ],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO event_staff_availability(event_day_id,staff_id,response) VALUES($1,$2,'available')",
      [day, id("staff@example.test")],
    );
    await pool.query(
      "INSERT INTO event_staffs(event_day_id,staff_id,role,assigned_by) VALUES($1,$2,'coordinator',$3)",
      [day, id("staff@example.test"), id("designated@example.test")],
    );
    await pool.query(
      "INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES($1,'accepted',$2)",
      [booking, id("staff@example.test")],
    );
    for (const entry of entries.filter(
      (e) =>
        e.name >= "20261114000000_drop_venues" &&
        e.name <= "20261114151517_complete_catalog_staff_removal",
    ))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    const roles = await pool.query(
      "SELECT email,role FROM users ORDER BY email",
    );
    assert.equal(roles.rowCount, users.rowCount);
    for (const row of roles.rows)
      assert.equal(
        row.role,
        row.email === "designated@example.test" ? "admin" : "customer",
      );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT u.email FROM sessions s JOIN users u ON u.id=s.user_id ORDER BY u.email",
        )
      ).rows,
      [
        { email: "customer@example.test" },
        { email: "designated@example.test" },
      ],
    );
    assert.equal(
      (await pool.query("SELECT id FROM catalog_pages")).rowCount,
      2,
    );
    assert.equal(
      (await pool.query("SELECT id FROM catalog_sections")).rowCount,
      2,
    );
    assert.equal(
      (await pool.query("SELECT id FROM catalog_widgets")).rowCount,
      2,
    );
    assert.equal((await pool.query("SELECT id FROM media_assets")).rowCount, 2);
    const stale = await pool.query(
      "SELECT m.id FROM media_assets m WHERE NOT EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id)",
    );
    assert.deepEqual(stale.rows, [{ id: exclusiveMedia }]);
    await assert.rejects(
      pool.query("INSERT INTO catalog_pages DEFAULT VALUES"),
      /catalog_pages_one_owner/,
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO catalog_pages(package_id,service_id) VALUES($1,$2)",
        [pkg, service],
      ),
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO users(email,password_hash,role) VALUES('new-staff@example.test','unused','staff')",
      ),
      /users_role_check/,
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT title,content,revision,updated_by FROM event_checklists WHERE id=$1",
          [checklist],
        )
      ).rows,
      [
        {
          title: "Retained tasks",
          content: tasks,
          revision: 7,
          updated_by: id("staff@example.test"),
        },
      ],
    );
    assert.equal(
      (
        await pool.query("SELECT id FROM booking_requests WHERE id=$1", [
          booking,
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM booking_request_status_history WHERE changed_by=$1",
          [id("staff@example.test")],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (await pool.query("SELECT id FROM events_day WHERE id=$1", [day]))
        .rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('venues','package_venues','event_staffs','event_staff_availability')",
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='users' AND column_name='staff_role') OR (table_name='catalog_pages' AND column_name='venue_id') OR (table_name='event_checklists' AND column_name IN ('coordinator_id','sent_at','sent_by')) OR (table_name='events_day' AND column_name IN ('staffing_status','availability_deadline')))",
        )
      ).rowCount,
      0,
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
