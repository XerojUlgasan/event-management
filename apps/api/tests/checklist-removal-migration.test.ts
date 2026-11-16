import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

test("checklist removal drops populated documents and validation while retaining schedules and booking history", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const database = `em_checklist_removal_${randomUUID().replaceAll("-", "")}`;
  const connection = {
    host,
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
    const migrationName = "20261114154206_remove_event_checklists";
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.filter((entry) => entry.name < migrationName))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    const user = (
      await pool.query(
        "INSERT INTO users(email,password_hash,role) VALUES('checklist-removal@example.test','unused','admin') RETURNING id",
      )
    ).rows[0].id;
    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Retained schedule','retained-schedule',100,1000) RETURNING id",
      )
    ).rows[0].id;
    const booking = (
      await pool.query(
        `INSERT INTO booking_requests(reference,customer_id,package_id,package_name,package_price,package_max_guests,event_type,preferred_date,time_zone,contact_name,phone_number,out_of_range,status)
        VALUES('CHECKLIST-REMOVAL',$1,$2,'Retained schedule',1000,100,'Wedding','2027-01-01','Asia/Manila','Customer','00000000000',false,'accepted') RETURNING id`,
        [user, pkg],
      )
    ).rows[0].id;
    const replacement = (
      await pool.query(
        "INSERT INTO events_day(booking_request_id,day,starts_at,ends_at) VALUES($1,'2027-01-02','2027-01-02T01:00Z','2027-01-02T02:00Z') RETURNING id",
        [booking],
      )
    ).rows[0].id;
    const original = (
      await pool.query(
        "INSERT INTO events_day(booking_request_id,day,starts_at,ends_at,status,replacement_event_day_id) VALUES($1,'2027-01-01','2027-01-01T01:00Z','2027-01-01T02:00Z','moved',$2) RETURNING id",
        [booking, replacement],
      )
    ).rows[0].id;
    const requested = [
      {
        date: "2027-01-01",
        startsAt: "2027-01-01T01:00:00Z",
        endsAt: "2027-01-01T02:00:00Z",
        eventDayId: original,
      },
    ];
    await pool.query(
      "UPDATE booking_requests SET requested_days=$2::jsonb WHERE id=$1",
      [booking, JSON.stringify(requested)],
    );
    await pool.query(
      "INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES($1,'accepted',$2)",
      [booking, user],
    );
    const tasks = {
      tasks: [
        {
          id: randomUUID(),
          title: "Completed preparation",
          instructions: "Remove this obsolete task",
          startsAt: "2027-01-01T01:00:00Z",
          endsAt: "2027-01-01T02:00:00Z",
          status: "completed",
          note: "",
          completedAt: "2027-01-01T02:00:00Z",
        },
      ],
    };
    for (const day of [original, replacement])
      await pool.query(
        "INSERT INTO event_checklists(event_day_id,title,content,revision,created_by,updated_by) VALUES($1,'Obsolete checklist',$2::jsonb,7,$3,$3)",
        [day, JSON.stringify(tasks), user],
      );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS count FROM event_checklists"))
        .rows[0].count,
      2,
    );
    const preservedQuery = `SELECT b.*,u.email,p.name AS current_package_name,
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM events_day d WHERE d.booking_request_id=b.id) AS days,
      (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM booking_request_status_history h WHERE h.booking_request_id=b.id) AS history
      FROM booking_requests b JOIN users u ON u.id=b.customer_id JOIN packages p ON p.id=b.package_id WHERE b.id=$1`;
    const before = (await pool.query(preservedQuery, [booking])).rows;
    for (const entry of entries.filter((entry) => entry.name === migrationName))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    assert.deepEqual(
      (await pool.query(preservedQuery, [booking])).rows,
      before,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT to_regclass('public.event_checklists') AS table_name",
        )
      ).rows[0].table_name,
      null,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT to_regprocedure('public.clemora_checklist_content_valid(jsonb)') AS validator",
        )
      ).rows[0].validator,
      null,
    );
    // The remaining operational schedule stays writable without checklist dependencies.
    await pool.query("UPDATE events_day SET status='cancelled' WHERE id=$1", [
      replacement,
    ]);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT status,replacement_event_day_id FROM events_day WHERE id=$1",
          [original],
        )
      ).rows,
      [{ status: "moved", replacement_event_day_id: replacement }],
    );
    assert.equal(
      (
        await pool.query("SELECT status FROM events_day WHERE id=$1", [
          replacement,
        ])
      ).rows[0].status,
      "cancelled",
    );
  } finally {
    await pool?.end();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        (
          await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1", [
            database,
          ])
        ).rowCount === 0
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
