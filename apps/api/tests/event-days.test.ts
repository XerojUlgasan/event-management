import "dotenv/config";
import { setTestConfig } from "./helpers/set-test-config.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_days_test_${randomUUID().replaceAll("-", "")}`;

let admin: Pool, pool: Pool;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let adminCookie: string, customerCookie: string, packageId: string;
const schedulePath = "/admin/event-days/schedule-requested-days";

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
  );
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );

  setTestConfig({ DB_NAME: database });
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: "admin" | "customer") {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        role,
        password_hash: "unused",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3600000),
      })
      .execute();

    return `em_session=${token}`;
  }
  adminCookie = await session("admin");
  customerCookie = await session("customer");
  packageId = (
    await db
      .insertInto("packages")
      .values({
        name: "Schedule package",
        slug: "schedule-package",
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

  if (admin) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const remaining = await admin.query(
        "SELECT 1 FROM pg_stat_activity WHERE datname = $1",
        [database],
      );

      if (remaining.rowCount === 0) break;

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = adminCookie,
) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());

  return response.json();
}

async function booking(dates = ["2027-01-01", "2027-01-02"]) {
  return (
    await read(
      await call(
        "/booking-requests",
        "POST",
        {
          packageId,
          eventType: "Wedding",
          durationMode: dates.length > 1 ? "multi_day" : "one_day",
          requestedDays: dates.map((date) => ({ date })),
          timeZone: "Asia/Manila",
          guestCount: 10,
          contactName: "Test customer",
          phoneNumber: "09170000000",
        },
        customerCookie,
      ),
      201,
    )
  ).bookingRequest;
}

async function current(id: string) {
  return (await read(await call(`/admin/booking-requests/${id}`)))
    .bookingRequest;
}

async function saveTime(id: string, date: string) {
  const row = await current(id);

  return (
    await read(
      await call(
        `/booking-requests/${id}/requested-days/${date}/times`,
        "PATCH",
        {
          startsAt: `${date}T01:00:00Z`,
          endsAt: `${date}T02:00:00Z`,
          expectedUpdatedAt: row.updatedAt,
        },
        customerCookie,
      ),
    )
  ).bookingRequest;
}

async function accept(id: string) {
  return (
    await read(
      await call(`/admin/booking-requests/${id}/status`, "PATCH", {
        status: "accepted",
      }),
    )
  ).bookingRequest;
}

async function schedule(id: string) {
  const row = await current(id);

  return read(
    await call(schedulePath, "POST", {
      bookingRequestId: id,
      expectedUpdatedAt: row.updatedAt,
    }),
  );
}

test("admin schedules ready requested dates, preserves pending times, and reloads linked days without duplicates", async () => {
  const inquiry = await booking();
  const timed = await saveTime(inquiry.id, "2027-01-01");
  await read(
    await call(schedulePath, "POST", {
      bookingRequestId: inquiry.id,
      expectedUpdatedAt: timed.updatedAt,
    }),
    409,
  );
  const accepted = await accept(inquiry.id);
  await read(
    await call(schedulePath, "POST", {
      bookingRequestId: inquiry.id,
      expectedUpdatedAt: timed.updatedAt,
    }),
    409,
  );
  await read(
    await call(
      schedulePath,
      "POST",
      { bookingRequestId: inquiry.id, expectedUpdatedAt: accepted.updatedAt },
      customerCookie,
    ),
    403,
  );
  const first = await schedule(inquiry.id);
  assert.equal(first.eventDays.length, 1);
  assert.equal(first.eventDays[0].day, "2027-01-01");
  assert.equal("staffingStatus" in first.eventDays[0], false);
  const reloaded = await current(inquiry.id);
  assert.equal(reloaded.requestedDays[0].eventDayId, first.eventDays[0].id);
  assert.equal(
    reloaded.requestedDays[0].operationalSchedule.id,
    first.eventDays[0].id,
  );
  assert.equal(reloaded.requestedDays[1].operationalSchedule, null);
  assert.equal(reloaded.requestedDays[1].startsAt, null);
  assert.equal((await schedule(inquiry.id)).eventDays.length, 1);
  assert.equal((await current(inquiry.id)).updatedAt, reloaded.updatedAt);
  await saveTime(inquiry.id, "2027-01-02");
  assert.equal((await schedule(inquiry.id)).eventDays.length, 2);
  const list = await read(
    await call(`/admin/event-days?bookingRequestId=${inquiry.id}`),
  );
  assert.equal(list.eventDays.length, 2);
  await pool.query(
    "UPDATE packages SET name='Updated schedule package' WHERE id=$1",
    [packageId],
  );
  const renamed = await read(
    await call(`/admin/event-days?bookingRequestId=${inquiry.id}`),
  );
  assert.ok(
    renamed.eventDays.every(
      (day: { packageName: string }) =>
        day.packageName === "Updated schedule package",
    ),
  );
});

test("scheduling validates the complete batch and serializes concurrent attempts", async () => {
  const inquiry = await booking(["2027-02-01", "2027-02-02"]);
  await accept(inquiry.id);
  await pool.query(
    "UPDATE booking_requests SET requested_days=$2::jsonb WHERE id=$1",
    [
      inquiry.id,
      JSON.stringify([
        {
          date: "2027-02-01",
          startsAt: "2027-02-01T01:00:00Z",
          endsAt: "2027-02-01T02:00:00Z",
        },
        {
          date: "2027-02-02",
          startsAt: "2027-02-03T01:00:00Z",
          endsAt: "2027-02-03T02:00:00Z",
        },
      ]),
    ],
  );
  const invalid = await current(inquiry.id);
  await read(
    await call(schedulePath, "POST", {
      bookingRequestId: inquiry.id,
      expectedUpdatedAt: invalid.updatedAt,
    }),
    400,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM events_day WHERE booking_request_id=$1",
        [inquiry.id],
      )
    ).rowCount,
    0,
  );
  assert.ok(
    (await current(inquiry.id)).requestedDays.every(
      (day: { eventDayId?: string }) => !day.eventDayId,
    ),
  );
  await saveTime(inquiry.id, "2027-02-02");
  const ready = await current(inquiry.id);

  const attempts = await Promise.all(
    [1, 2].map(() =>
      call(schedulePath, "POST", {
        bookingRequestId: inquiry.id,
        expectedUpdatedAt: ready.updatedAt,
      }),
    ),
  );

  assert.deepEqual(
    attempts.map((response) => response.status).sort(),
    [200, 409],
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM events_day WHERE booking_request_id=$1",
        [inquiry.id],
      )
    ).rowCount,
    2,
  );
});

test("moving a requested-day schedule preserves history and cancellation follows its replacement", async () => {
  const inquiry = await booking(["2027-03-01"]);
  await saveTime(inquiry.id, "2027-03-01");
  await accept(inquiry.id);
  const day = (await schedule(inquiry.id)).eventDays[0];
  const replacement = (
    await read(
      await call(`/admin/event-days/${day.id}/move`, "POST", {
        day: "2027-03-02",
        startsAt: "2027-03-02T01:00:00Z",
        endsAt: "2027-03-02T02:00:00Z",
      }),
    )
  ).eventDay;
  assert.notEqual(replacement.id, day.id);
  assert.equal(replacement.status, "scheduled");
  const movedDays = (
    await read(await call(`/admin/event-days?bookingRequestId=${inquiry.id}`))
  ).eventDays;

  const oldDay = movedDays.find((item: { id: string }) => item.id === day.id);

  assert.equal(oldDay.status, "moved");
  assert.equal(oldDay.replacementEventDayId, replacement.id);
  const reloaded = await current(inquiry.id);
  assert.equal(reloaded.requestedDays[0].eventDayId, day.id);
  assert.equal(
    reloaded.requestedDays[0].operationalSchedule.id,
    replacement.id,
  );
  await read(
    await call(
      `/booking-requests/${inquiry.id}/cancel`,
      "PATCH",
      { reason: "Plans changed" },
      customerCookie,
    ),
  );
  const cancelledDays = (
    await read(await call(`/admin/event-days?bookingRequestId=${inquiry.id}`))
  ).eventDays;
  assert.equal(
    cancelledDays.find((item: { id: string }) => item.id === replacement.id)
      .status,
    "cancelled",
  );
  assert.equal(
    cancelledDays.find((item: { id: string }) => item.id === day.id).status,
    "moved",
  );
  const cancelled = await current(inquiry.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(
    cancelled.requestedDays[0].operationalSchedule.status,
    "cancelled",
  );
});

test("removed venue, staff, and checklist operations are absent from Node and Edge API contracts", async () => {
  const { app: edgeApp } = await import("../src/edge/server.js");

  for (const runtime of [app, edgeApp]) {
    const document = await read(await runtime.request("/openapi.json"));

    for (const path of Object.keys(document.paths))
      assert.equal(
        /\/venues(?:\/|$)|\/staff(?:\/|$)|\/checklist(?:\/|$)|apply-response-deadlines/.test(
          path,
        ),
        false,
        path,
      );

    assert.ok(document.paths[`/v1${schedulePath}`]);

    for (const method of ["GET", "POST", "PATCH"]) {
      for (const path of [
        "/admin/event-days/00000000-0000-4000-8000-000000000001/checklist",
        "/admin/event-days/00000000-0000-4000-8000-000000000001/checklist/send",
      ]) {
        const response = await runtime.request(`/v1${path}`, {
          method,
          headers: { Cookie: adminCookie },
        });
        assert.equal(
          response.status,
          404,
          `${method} ${path}: ${await response.text()}`,
        );
      }
    }
  }

  for (const path of [
    "/venues",
    "/admin/venues",
    "/staff/event-days",
    "/staff/assignments",
  ])
    assert.equal((await call(path)).status, 404);
});

test("legacy manual schedules enforce admin access and retain cancellation history", async () => {
  const inquiry = await booking(["2027-04-01"]);
  await accept(inquiry.id);
  const input = {
    bookingRequestId: inquiry.id,
    day: "2027-04-01",
    startsAt: "2027-04-01T01:00:00Z",
    endsAt: "2027-04-01T02:00:00Z",
  };
  await read(await call("/admin/event-days", "POST", input), 409);
  await pool.query(
    "UPDATE booking_requests SET requested_days=NULL WHERE id=$1",
    [inquiry.id],
  );
  await read(
    await call("/admin/event-days", "POST", input, customerCookie),
    403,
  );
  await read(
    await call("/admin/event-days", "POST", { ...input, day: "2027-04-02" }),
    400,
  );
  const day = (await read(await call("/admin/event-days", "POST", input), 201))
    .eventDay;
  assert.equal(day.status, "scheduled");
  const cancelled = (
    await read(await call(`/admin/event-days/${day.id}/cancel`, "POST"))
  ).eventDay;
  assert.equal(cancelled.status, "cancelled");
  assert.equal(
    (await read(await call(`/admin/event-days?bookingRequestId=${inquiry.id}`)))
      .eventDays[0].status,
    "cancelled",
  );
  await read(await call(`/admin/event-days/${day.id}/cancel`, "POST"), 409);
});
