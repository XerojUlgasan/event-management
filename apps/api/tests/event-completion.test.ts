import "dotenv/config";
import { setTestConfig } from "./helpers/set-test-config.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "../src/db/types.js";
import { completeEndedBookings } from "../src/services/booking-requests/complete-ended-bookings.js";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_event_completion_test_${randomUUID().replaceAll("-", "")}`;

const automaticCompletionMigration =
  "20261124130000_finish_bookings_automatically";

const [firstDate, secondDate, replacementDate] = [2, 3, 4].map((daysAway) =>
  new Date(Date.now() + daysAway * 86_400_000).toISOString().slice(0, 10),
);

type Account = { id: string; cookie: string };

let adminPool: Pool;
let pool: Pool;
let db: typeof import("../src/db/client.js").db;
let app: typeof import("../src/app.js").app;
let administrator: Account;
let secondAdministrator: Account;
let customer: Account;
let packageId: string;
let legacyFinishedBookingId: string;

before(async () => {
  const connection = databaseConnection();
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(connection.host));
  adminPool = new Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });

  const migrations = new URL("../prisma/migrations/", import.meta.url);

  const entries = (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const automaticCompletionIndex = entries.findIndex(
    (entry) => entry.name === automaticCompletionMigration,
  );

  assert.notEqual(automaticCompletionIndex, -1);

  for (const entry of entries.slice(0, automaticCompletionIndex))
    await applyMigration(migrations, entry.name);

  setTestConfig({ DB_NAME: database });
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  administrator = await account("admin");
  secondAdministrator = await account("admin");
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

  const legacyFinished = await booking();
  legacyFinishedBookingId = legacyFinished.id;
  const legacyFinish = await pool.query(
    `WITH finish_time AS (SELECT clock_timestamp() AS finished_at)
     UPDATE booking_requests
     SET status='accepted',
         event_ready_at=finish_time.finished_at - interval '1 second',
         event_finished_at=finish_time.finished_at,
         event_finished_by=$2,
         updated_at=finish_time.finished_at
     FROM finish_time
     WHERE id=$1
     RETURNING event_finished_at`,
    [legacyFinished.id, administrator.id],
  );
  const legacyFinishedAt = legacyFinish.rows[0]!.event_finished_at as Date;

  await applyMigration(migrations, automaticCompletionMigration);

  for (const entry of entries.slice(automaticCompletionIndex + 1))
    await applyMigration(migrations, entry.name);

  const migratedLegacyBooking = await pool.query(
    "SELECT status FROM booking_requests WHERE id=$1",
    [legacyFinished.id],
  );
  assert.equal(migratedLegacyBooking.rows[0]!.status, "finished");

  const migratedLegacyHistory = await pool.query(
    `SELECT status, changed_by, created_at
     FROM booking_request_status_history
     WHERE booking_request_id=$1 AND status='finished'`,
    [legacyFinished.id],
  );
  assert.equal(migratedLegacyHistory.rowCount, 1);
  assert.equal(migratedLegacyHistory.rows[0]!.changed_by, administrator.id);
  assert.equal(
    (migratedLegacyHistory.rows[0]!.created_at as Date).toISOString(),
    legacyFinishedAt.toISOString(),
  );
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

function databaseConnection() {
  return {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

async function applyMigration(migrations: URL, name: string) {
  await pool.query(
    await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
  );
}

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

async function accept(id: string) {
  await read(
    await call(`/admin/booking-requests/${id}/status`, "PATCH", {
      status: "accepted",
    }),
  );
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

  await accept(bookingRequestId);
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

async function setScheduledDaysEnded(bookingRequestId: string) {
  await pool.query(
    `UPDATE events_day
     SET starts_at=clock_timestamp() - interval '2 days',
         ends_at=clock_timestamp() - interval '1 day'
     WHERE booking_request_id=$1 AND status='scheduled'`,
    [bookingRequestId],
  );
}

async function status(id: string) {
  return (
    await pool.query("SELECT status FROM booking_requests WHERE id=$1", [id])
  ).rows[0]!.status;
}

async function countNotifications(
  bookingRequestId: string,
  type: "event_finished" | "event_ready_to_finish",
  recipientId?: string,
) {
  const result = await pool.query(
    `SELECT id
     FROM notifications
     WHERE type=$1 AND source_event_id=$2
       AND ($3::uuid IS NULL OR recipient_user_id=$3)`,
    [type, bookingRequestId, recipientId ?? null],
  );

  return result.rowCount;
}

test("finished migration preserves a legacy admin completion", async () => {
  assert.equal(await status(legacyFinishedBookingId), "finished");
});

test("finishes due multi-day bookings once and notifies every admin and the owner", async () => {
  const inquiry = await booking();
  await schedule(inquiry.id);
  await setScheduledDaysEnded(inquiry.id);

  await read(
    await call(`/admin/booking-requests/${inquiry.id}/status`, "PATCH", {
      status: "finished",
    }),
    400,
  );

  const legacyPayload = {
    bookingRequestId: inquiry.id,
    bookingReference: inquiry.reference,
  };
  await pool.query(
    `INSERT INTO notifications
       (recipient_user_id, type, source_event_id, payload)
     VALUES ($1, 'event_ready_to_finish', $2, $3::jsonb)`,
    [administrator.id, inquiry.id, JSON.stringify(legacyPayload)],
  );

  await rejectFinishedNotifications(() => completeEndedBookings(db));
  assert.equal(await status(inquiry.id), "accepted");
  assert.equal(await finishedHistoryCount(inquiry.id), 0);
  assert.equal(await countNotifications(inquiry.id, "event_finished"), 0);

  await Promise.all([completeEndedBookings(db), completeEndedBookings(db)]);

  const bookingRequest = await current(inquiry.id);
  assert.equal(bookingRequest.status, "finished");
  assert.equal(Object.hasOwn(bookingRequest, "eventCompletion"), false);
  assert.equal(await finishedHistoryCount(inquiry.id), 1);

  const history = await pool.query(
    `SELECT status, changed_by, reason
     FROM booking_request_status_history
     WHERE booking_request_id=$1 AND status='finished'`,
    [inquiry.id],
  );
  assert.equal(history.rows[0]!.changed_by, null);
  assert.equal(history.rows[0]!.reason, null);

  for (const recipient of [administrator, secondAdministrator, customer])
    assert.equal(
      await countNotifications(inquiry.id, "event_finished", recipient.id),
      1,
    );

  const finishedNotification = await pool.query(
    `SELECT type, source_event_id, payload
     FROM notifications
     WHERE type='event_finished' AND source_event_id=$1
     ORDER BY recipient_user_id
     LIMIT 1`,
    [inquiry.id],
  );
  assert.deepEqual(finishedNotification.rows[0]!.payload, legacyPayload);
  assert.equal(finishedNotification.rows[0]!.source_event_id, inquiry.id);

  assert.equal(
    await countNotifications(inquiry.id, "event_ready_to_finish"),
    1,
  );
  const notifications = await read(
    await call("/notifications?includeBookingDetails=1"),
  );
  assert.ok(
    notifications.notifications.some(
      (notification: { type: string; payload: unknown }) =>
        notification.type === "event_ready_to_finish" &&
        JSON.stringify(notification.payload) === JSON.stringify(legacyPayload),
    ),
  );

  await read(
    await call(`/admin/booking-requests/${inquiry.id}/status`, "PATCH", {
      status: "accepted",
    }),
    409,
  );
});

test("requires a live scheduled day and ignores unscheduled, moved, or cancelled dates", async () => {
  const noDays = await booking();
  await accept(noDays.id);

  const future = await booking();
  await schedule(future.id);

  const needsDetails = await booking();
  await schedule(needsDetails.id);
  await setScheduledDaysEnded(needsDetails.id);
  await read(
    await call(`/admin/booking-requests/${needsDetails.id}/status`, "PATCH", {
      status: "needs_details",
      reason: "Waiting for event details",
    }),
  );

  const declined = await booking();
  await schedule(declined.id);
  await setScheduledDaysEnded(declined.id);
  await pool.query(
    "UPDATE booking_requests SET status='declined' WHERE id=$1",
    [declined.id],
  );

  const cancelled = await booking();
  await schedule(cancelled.id);
  await setScheduledDaysEnded(cancelled.id);
  await pool.query(
    "UPDATE booking_requests SET status='cancelled' WHERE id=$1",
    [cancelled.id],
  );

  const moved = await booking();
  const [first, second] = await schedule(moved.id);
  await pool.query(
    `UPDATE events_day
     SET starts_at=clock_timestamp() - interval '2 days',
         ends_at=clock_timestamp() - interval '1 day'
     WHERE id=$1`,
    [first!.id],
  );
  const replacement = (
    await read(
      await call(`/admin/event-days/${second!.id}/move`, "POST", {
        day: replacementDate,
        startsAt: `${replacementDate}T01:00:00Z`,
        endsAt: `${replacementDate}T02:00:00Z`,
      }),
    )
  ).eventDay;

  await completeEndedBookings(db);
  assert.equal(await status(noDays.id), "accepted");
  assert.equal(await status(future.id), "accepted");
  assert.equal(await status(needsDetails.id), "needs_details");
  assert.equal(await status(declined.id), "declined");
  assert.equal(await status(cancelled.id), "cancelled");
  assert.equal(await status(moved.id), "accepted");

  await read(await call(`/admin/event-days/${replacement.id}/cancel`, "POST"));
  await pool.query(
    `UPDATE booking_requests
     SET requested_days=jsonb_set(requested_days, '{1}', (requested_days->1) - 'eventDayId')
     WHERE id=$1`,
    [moved.id],
  );
  await completeEndedBookings(db);
  assert.equal(await status(moved.id), "finished");
});

test("waits until the database clock is strictly after the latest scheduled end", async () => {
  await pool.query("CREATE SCHEMA event_completion_test_clock");
  await pool.query(`
    CREATE FUNCTION event_completion_test_clock.clock_timestamp()
    RETURNS timestamptz LANGUAGE sql AS $$
      SELECT '2026-05-03T00:00:00.123456Z'::timestamptz
    $$
  `);

  const boundaryPool = new Pool({
    ...databaseConnection(),
    database,
    max: 1,
    options: "-c search_path=event_completion_test_clock,pg_catalog,public",
  });
  const boundaryDb = new Kysely<DB>({
    dialect: new PostgresDialect({ pool: boundaryPool }),
  });

  try {
    const inquiry = await booking();
    const [, last] = await schedule(inquiry.id);
    const exactEnd = "2026-05-03T00:00:00.123456Z";
    await pool.query(
      `UPDATE events_day
       SET starts_at=$2::timestamptz - interval '2 hours',
           ends_at=$2::timestamptz - interval '1 hour'
       WHERE booking_request_id=$1 AND status='scheduled'`,
      [inquiry.id, exactEnd],
    );
    await pool.query(
      `UPDATE events_day
       SET starts_at=$2::timestamptz - interval '1 hour',
           ends_at=$2::timestamptz
       WHERE id=$1`,
      [last!.id, exactEnd],
    );

    await completeEndedBookings(boundaryDb);
    assert.equal(await status(inquiry.id), "accepted");

    await pool.query(
      "UPDATE events_day SET ends_at=$2::timestamptz - interval '1 microsecond' WHERE id=$1",
      [last!.id, exactEnd],
    );
    await completeEndedBookings(boundaryDb);
    assert.equal(await status(inquiry.id), "finished");
  } finally {
    await boundaryDb.destroy();
    await pool.query(
      "DROP SCHEMA IF EXISTS event_completion_test_clock CASCADE",
    );
  }
});

async function finishedHistoryCount(bookingRequestId: string) {
  const result = await pool.query(
    "SELECT id FROM booking_request_status_history WHERE booking_request_id=$1 AND status='finished'",
    [bookingRequestId],
  );

  return result.rowCount;
}

async function rejectFinishedNotifications(action: () => Promise<unknown>) {
  await pool.query(
    "ALTER TABLE notifications ADD CONSTRAINT test_reject_event_finished CHECK (type <> 'event_finished') NOT VALID",
  );

  try {
    await action();
  } finally {
    await pool.query(
      "ALTER TABLE notifications DROP CONSTRAINT test_reject_event_finished",
    );
  }
}
