import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { sql } from "kysely";
import { Pool } from "pg";
import { liveEventDaysHaveEndedData } from "../src/data/booking-requests/event-completion.js";
import { checkEventCompletionReadiness } from "../src/services/booking-requests/check-event-completion-readiness.js";
import { finishEventService } from "../src/services/booking-requests/finish-event.js";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_event_completion_test_${randomUUID().replaceAll("-", "")}`;

const [firstDate, secondDate, replacementDate] = [2, 3, 4].map((daysAway) =>
  new Date(Date.now() + daysAway * 86_400_000).toISOString().slice(0, 10),
);

type Account = { id: string; cookie: string };

let adminPool: Pool;
let pool: Pool;
let db: typeof import("../src/db/client.js").db;
let app: typeof import("../src/app.js").app;
let administrator: Account;
let customer: Account;
let packageId: string;

before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  adminPool = new Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });

  const migrations = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(
        new URL(`${entry.name}/migration.sql`, migrations),
        "utf8",
      ),
    );

  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  administrator = await account("admin");
  customer = await account("customer");
  packageId = (
    await db
      .insertInto("packages")
      .values({
        name: "Completion test package",
        slug: `completion-${randomUUID()}`,
        max_guests: 100,
        price: 1000,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();

  if (adminPool) {
    try {
      await adminPool.query(
        `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
      );
    } finally {
      await adminPool.end();
    }
  }
});

async function account(role: "admin" | "customer"): Promise<Account> {
  const token = randomUUID();
  const { id } = await db
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      password_hash: "unused",
      role,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("sessions")
    .values({
      user_id: id,
      token_hash: hashSessionToken(token),
      expires_at: new Date(Date.now() + 3_600_000),
    })
    .execute();

  return { id, cookie: `em_session=${token}` };
}

function call(
  path: string,
  method = "GET",
  body?: unknown,
  viewer = administrator,
) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      Cookie: viewer.cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());

  return response.json();
}

async function booking() {
  const result = (
    await read(
      await call(
        "/booking-requests",
        "POST",
        {
          packageId,
          eventType: "Wedding",
          durationMode: "multi_day",
          requestedDays: [{ date: firstDate }, { date: secondDate }],
          timeZone: "Asia/Manila",
          guestCount: 10,
          contactName: "Completion customer",
          phoneNumber: "09170000000",
        },
        customer,
      ),
      201,
    )
  ).bookingRequest;

  return result;
}

async function current(id: string) {
  return (await read(await call(`/admin/booking-requests/${id}`)))
    .bookingRequest;
}

async function schedule(bookingRequestId: string) {
  for (const date of [firstDate, secondDate]) {
    const row = await current(bookingRequestId);
    await read(
      await call(
        `/booking-requests/${bookingRequestId}/requested-days/${date}/times`,
        "PATCH",
        {
          startsAt: `${date}T01:00:00Z`,
          endsAt: `${date}T02:00:00Z`,
          expectedUpdatedAt: row.updatedAt,
        },
        customer,
      ),
    );
  }

  await read(
    await call(`/admin/booking-requests/${bookingRequestId}/status`, "PATCH", {
      status: "accepted",
    }),
  );
  const row = await current(bookingRequestId);

  return (
    await read(
      await call("/admin/event-days/schedule-requested-days", "POST", {
        bookingRequestId,
        expectedUpdatedAt: row.updatedAt,
      }),
    )
  ).eventDays as Array<{ id: string }>;
}

async function rejectCompletionAlerts(
  type: "event_ready_to_finish" | "event_finished",
  action: () => Promise<unknown>,
) {
  await pool.query(
    `ALTER TABLE notifications ADD CONSTRAINT test_reject_completion_alert CHECK (type <> '${type}') NOT VALID`,
  );

  try {
    await action();
  } finally {
    await pool.query(
      "ALTER TABLE notifications DROP CONSTRAINT test_reject_completion_alert",
    );
  }
}

test("readiness waits for the latest scheduled day, deduplicates alerts, then finishes once", async () => {
  const inquiry = await booking();
  const eventDays = await schedule(inquiry.id);
  await pool.query(
    "UPDATE events_day SET starts_at=clock_timestamp() - interval '2 days', ends_at=clock_timestamp() - interval '1 day' WHERE id=$1",
    [eventDays[0]!.id],
  );
  await pool.query(
    "UPDATE events_day SET starts_at=clock_timestamp() - interval '2 days', ends_at=clock_timestamp() + interval '1 day' WHERE id=$1",
    [eventDays[1]!.id],
  );
  await pool.query(
    "UPDATE booking_requests SET requested_days=NULL WHERE id=$1",
    [inquiry.id],
  );

  await checkEventCompletionReadiness(db);
  let row = await pool.query(
    "SELECT event_ready_at, event_finished_at, updated_at FROM booking_requests WHERE id=$1",
    [inquiry.id],
  );
  assert.equal(row.rows[0]!.event_ready_at, null);
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM notifications WHERE type='event_ready_to_finish' AND source_event_id=$1",
        [inquiry.id],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM notifications WHERE type='event_ready_to_finish' AND source_event_id=$1 AND recipient_user_id=$2",
        [inquiry.id, customer.id],
      )
    ).rowCount,
    0,
  );

  await pool.query(
    `UPDATE events_day
     SET starts_at=clock_timestamp() - interval '2 days',
         ends_at=clock_timestamp() - interval '1 millisecond'
     WHERE booking_request_id=$1
       AND ends_at=(SELECT max(ends_at) FROM events_day WHERE booking_request_id=$1)`,
    [inquiry.id],
  );
  await rejectCompletionAlerts("event_ready_to_finish", () =>
    checkEventCompletionReadiness(db),
  );
  assert.equal((await current(inquiry.id)).eventCompletion, null);
  await Promise.all([
    checkEventCompletionReadiness(db),
    checkEventCompletionReadiness(db),
  ]);

  row = await pool.query(
    "SELECT event_ready_at, event_finished_at, updated_at FROM booking_requests WHERE id=$1",
    [inquiry.id],
  );
  assert.ok(row.rows[0]!.event_ready_at);
  assert.equal(row.rows[0]!.event_finished_at, null);
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM notifications WHERE type='event_ready_to_finish' AND source_event_id=$1",
        [inquiry.id],
      )
    ).rowCount,
    1,
  );

  const currentBooking = await current(inquiry.id);
  await rejectCompletionAlerts("event_finished", () =>
    assert.rejects(
      finishEventService(
        db,
        inquiry.id,
        administrator.id,
        currentBooking.updatedAt,
      ),
      { code: "23514" },
    ),
  );
  assert.equal((await current(inquiry.id)).eventCompletion.status, "ready");
  await read(
    await call(
      `/admin/booking-requests/${inquiry.id}/finish`,
      "POST",
      { expectedUpdatedAt: currentBooking.updatedAt },
      customer,
    ),
    403,
  );
  await read(
    await call(`/admin/booking-requests/${inquiry.id}/finish`, "POST", {
      expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
    }),
    409,
  );

  const finish = () =>
    call(`/admin/booking-requests/${inquiry.id}/finish`, "POST", {
      expectedUpdatedAt: currentBooking.updatedAt,
    });

  const results = await Promise.all([finish(), finish()]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 200]);

  const bodies = await Promise.all(results.map((result) => result.json()));

  assert.ok(
    bodies.every(
      (body) => body.bookingRequest.eventCompletion.status === "finished",
    ),
  );
  assert.equal(
    bodies[0].bookingRequest.eventCompletion.finishedAt,
    bodies[1].bookingRequest.eventCompletion.finishedAt,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM notifications WHERE type='event_finished' AND source_event_id=$1 AND recipient_user_id=$2",
        [inquiry.id, customer.id],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM notifications WHERE type='event_finished' AND source_event_id=$1 AND recipient_user_id=$2",
        [inquiry.id, administrator.id],
      )
    ).rowCount,
    0,
  );
});

test("requested-day links follow a moved schedule to cancellation, while an unlinked day blocks readiness", async () => {
  const inquiry = await booking();
  const eventDays = await schedule(inquiry.id);
  const moved = (
    await read(
      await call(`/admin/event-days/${eventDays[1]!.id}/move`, "POST", {
        day: replacementDate,
        startsAt: `${replacementDate}T01:00:00Z`,
        endsAt: `${replacementDate}T02:00:00Z`,
      }),
    )
  ).eventDay;
  await read(await call(`/admin/event-days/${moved.id}/cancel`, "POST"));
  await pool.query(
    "UPDATE events_day SET starts_at=clock_timestamp() - interval '2 days', ends_at=clock_timestamp() - interval '1 millisecond' WHERE id=$1",
    [eventDays[0]!.id],
  );
  await checkEventCompletionReadiness(db);
  assert.ok(
    (
      await pool.query(
        "SELECT event_ready_at FROM booking_requests WHERE id=$1",
        [inquiry.id],
      )
    ).rows[0]!.event_ready_at,
  );

  const pending = await booking();
  const pendingDays = await schedule(pending.id);
  await pool.query(
    `UPDATE booking_requests
     SET requested_days=jsonb_set(requested_days, '{1}', (requested_days->1) - 'eventDayId')
     WHERE id=$1`,
    [pending.id],
  );
  await pool.query(
    "UPDATE events_day SET starts_at=clock_timestamp() - interval '2 days', ends_at=clock_timestamp() - interval '1 millisecond' WHERE booking_request_id=$1",
    [pending.id],
  );
  await checkEventCompletionReadiness(db);
  assert.equal(
    (
      await pool.query(
        "SELECT event_ready_at FROM booking_requests WHERE id=$1",
        [pending.id],
      )
    ).rows[0]!.event_ready_at,
    null,
  );
  assert.equal(pendingDays.length, 2);
});

test("the PostgreSQL readiness check includes the exact end instant", async () => {
  const inquiry = await booking();
  const [earlier, last] = await schedule(inquiry.id);

  await db.transaction().execute(async (trx) => {
    await sql`CREATE SCHEMA event_completion_test_clock`.execute(trx);
    await sql`
      CREATE FUNCTION event_completion_test_clock.clock_timestamp()
      RETURNS timestamptz LANGUAGE sql AS $$
        SELECT '2026-05-03T00:00:00.123456Z'::timestamptz
      $$
    `.execute(trx);
    await sql`SET LOCAL search_path TO event_completion_test_clock, pg_catalog, public`.execute(
      trx,
    );
    await sql`UPDATE events_day SET starts_at = '2026-05-02T20:00:00Z', ends_at = '2026-05-02T23:00:00Z' WHERE id = ${earlier!.id}`.execute(
      trx,
    );
    await sql`UPDATE events_day SET starts_at = '2026-05-02T23:00:00Z', ends_at = clock_timestamp() + interval '1 microsecond' WHERE id = ${last!.id}`.execute(
      trx,
    );
    assert.equal(await liveEventDaysHaveEndedData(trx, inquiry.id), false);
    await sql`UPDATE events_day SET ends_at = clock_timestamp() WHERE id = ${last!.id}`.execute(
      trx,
    );
    assert.equal(await liveEventDaysHaveEndedData(trx, inquiry.id), true);
    await sql`DROP SCHEMA event_completion_test_clock CASCADE`.execute(trx);
  });
});
