import { responseDeadlineForDay, RESPONSE_DEADLINE_DAYS, type ResponseDeadlineDays } from "@event-management/contracts/event-days";
import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_event_days_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db | undefined;
let admin: Pool | undefined;
let pool: Pool | undefined;
let adminCookie = "";
let staffOneCookie = "";
let staffTwoCookie = "";
let staffThreeCookie = "";
let customerCookie = "";
let otherAdminCookie = "";
let adminId = "";
let staffOneId = "";
let staffTwoId = "";
let staffThreeId = "";
let customerId = "";

type JsonRecord = Record<string, unknown>;
type UserRole = "admin" | "staff" | "customer";
type Schedule = {
  day: string;
  startsAt: string;
  endsAt: string;
  staffingStatus: "draft" | "open";
  daysBefore?: ResponseDeadlineDays | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function stringField(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function arrayField(record: JsonRecord, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value;
}

function eventDay(body: unknown): JsonRecord {
  return asRecord(asRecord(body, "response").eventDay, "eventDay");
}

function eventDays(body: unknown): JsonRecord[] {
  return arrayField(asRecord(body, "response"), "eventDays").map((value) => asRecord(value, "event day"));
}

function dayId(day: JsonRecord): string {
  return stringField(day, "id");
}

async function call(path: string, method = "GET", body?: unknown, cookie?: string): Promise<Response> {
  return await app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status: number): Promise<unknown> {
  assert.equal(response.status, status, await response.clone().text());
  if (response.status === 204) return null;
  const body: unknown = await response.json();
  return body;
}

async function expectError(response: Response, status: number): Promise<string> {
  const body = asRecord(await read(response, status), "error response");
  const message = stringField(body, "error");
  assert.ok(message.length > 0);
  return message;
}

function futureDeadline(seconds = 3600): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    day: "2099-05-20",
    startsAt: "2099-05-20T10:00:00+08:00",
    endsAt: "2099-05-20T12:00:00+08:00",
    staffingStatus: "draft",
    daysBefore: null,
    ...overrides,
  };
}

async function createEventDay(bookingRequestId: string, input: Partial<Schedule> = {}): Promise<JsonRecord> {
  const result = await read(
    await call("/admin/event-days", "POST", { bookingRequestId, ...schedule(input) }, adminCookie),
    201,
  );
  return eventDay(result);
}

async function setStaffing(
  id: string,
  staffingStatus: "open" | "closed",
  daysBefore?: ResponseDeadlineDays,
): Promise<JsonRecord> {
  return eventDay(await read(
    await call(`/admin/event-days/${id}/staffing`, "PATCH", {
      staffingStatus,
      ...(daysBefore === undefined ? {} : { daysBefore }),
    }, adminCookie),
    200,
  ));
}

async function respond(id: string, response: "available" | "unavailable", cookie: string): Promise<JsonRecord> {
  return eventDay(await read(
    await call(`/staff/event-days/${id}/availability`, "PUT", { response }, cookie),
    200,
  ));
}

async function assign(
  id: string,
  staffId: string,
  role: "coordinator" | "helper",
  status: "confirmed" | "cancelled" = "confirmed",
  expectedStatus = 200,
): Promise<unknown> {
  return read(
    await call(`/admin/event-days/${id}/assignments/${staffId}`, "PUT", { role, status }, adminCookie),
    expectedStatus,
  );
}

async function createUser(role: UserRole, displayName: string, staffRole?: string): Promise<{ id: string; cookie: string }> {
  const activePool = pool;
  assert.ok(activePool);
  const id = randomUUID();
  const token = randomUUID();
  const title = role === "admin" ? (staffRole ?? "System Administrator") : (staffRole ?? null);
  await activePool.query(
    "INSERT INTO users (id, email, display_name, password_hash, role, staff_role) VALUES ($1, $2, $3, 'unused', $4, $5)",
    [id, `${role}-${randomUUID()}@example.test`, displayName, role, title],
  );
  await activePool.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [id, hashSessionToken(token), new Date(Date.now() + 3_600_000)],
  );
  return { id, cookie: `em_session=${token}` };
}

async function createBooking(status: "accepted" | "under_review" = "accepted", timeZone = "Asia/Manila"): Promise<string> {
  const activePool = pool;
  assert.ok(activePool);
  const packageId = randomUUID();
  const bookingRequestId = randomUUID();
  const packageName = `Staffing fixture ${randomUUID()}`;
  await activePool.query(
    "INSERT INTO packages (id, name, slug, max_guests, price) VALUES ($1, $2, $3, 100, 100000)",
    [packageId, packageName, `staffing-${randomUUID()}`],
  );
  await activePool.query(
    `INSERT INTO booking_requests (
       id, reference, customer_id, package_id, package_name, package_price, package_max_guests,
       event_type, preferred_date, estimated_duration, time_zone, contact_name, phone_number,
       status, out_of_range
     ) VALUES ($1, $2, $3, $4, $5, 100000, 100, 'Wedding', '2099-05-20', 'undecided', $6, 'Customer fixture', '123', $7, false)`,
    [bookingRequestId, `STAFF-${randomUUID()}`, customerId, packageId, packageName, timeZone, status],
  );
  return bookingRequestId;
}

async function rowCount(query: string, values: readonly unknown[] = []): Promise<number> {
  const activePool = pool;
  assert.ok(activePool);
  const result = await activePool.query(query, [...values]);
  return result.rowCount ?? 0;
}

async function listBookingEventDays(bookingRequestId: string): Promise<JsonRecord[]> {
  return eventDays(await read(
    await call(`/admin/event-days?bookingRequestId=${bookingRequestId}`, "GET", undefined, adminCookie),
    200,
  ));
}

async function updateBookingStatus(bookingRequestId: string, status: "needs_details" | "cancelled" | "accepted", reason?: string): Promise<JsonRecord> {
  const body = await read(
    await call(`/admin/booking-requests/${bookingRequestId}/status`, "PATCH", { status, reason }, adminCookie),
    200,
  );
  return asRecord(asRecord(body, "booking status response").bookingRequest, "booking request");
}

async function waitForStaffLockWait(blockerPid: number, staffId: string): Promise<void> {
  const activePool = pool;
  assert.ok(activePool);
  const expiresAt = Date.now() + 5000;
  while (Date.now() < expiresAt) {
    const waiting = await activePool.query<{ pid: number }>(
      `SELECT pid FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock'
         AND $1 = ANY(pg_blocking_pids(pid))
         AND query ILIKE '%users%'
         AND query ILIKE '%for update%'`,
      [blockerPid],
    );
    if (waiting.rowCount && waiting.rows.length > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Availability request did not wait on staff row ${staffId}`);
}

async function waitUntil(timestamp: number): Promise<void> {
  const delay = timestamp - Date.now();
  if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST ?? "localhost"),
    "Tests require local PostgreSQL",
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
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  }

  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));

  const administrator = await createUser("admin", "System Administrator");
  adminId = administrator.id;
  adminCookie = administrator.cookie;
  const staffOne = await createUser("staff", "Staff One", "Event Staff");
  staffOneId = staffOne.id;
  staffOneCookie = staffOne.cookie;
  const staffTwo = await createUser("staff", "Staff Two", "Event Staff");
  staffTwoId = staffTwo.id;
  staffTwoCookie = staffTwo.cookie;
  const staffThree = await createUser("staff", "Staff Three", "Event Staff");
  staffThreeId = staffThree.id;
  staffThreeCookie = staffThree.cookie;
  const customer = await createUser("customer", "Customer");
  customerId = customer.id;
  customerCookie = customer.cookie;
  const otherAdministrator = await createUser("admin", "Wrong Admin Title", "Event Manager");
  otherAdminCookie = otherAdministrator.cookie;
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

test("permissions, accepted bookings, local event days, deadlines, and staff redaction follow the API contract", async () => {
  const acceptedBooking = await createBooking();
  const pendingBooking = await createBooking("under_review");
  const valid = schedule({
    day: "2099-05-20",
    startsAt: "2099-05-20T20:00:00+08:00",
    endsAt: "2099-05-21T02:00:00+08:00",
  });

  await expectError(await call("/admin/event-days", "GET"), 401);
  await expectError(await call("/admin/event-days", "GET", undefined, customerCookie), 403);
  await expectError(await call("/admin/event-days", "GET", undefined, staffOneCookie), 403);
  await expectError(await call("/admin/event-days", "GET", undefined, otherAdminCookie), 403);
  await expectError(await call("/staff/event-days", "GET"), 401);
  await expectError(await call("/staff/event-days", "GET", undefined, customerCookie), 403);
  await expectError(await call("/staff/event-days", "GET", undefined, adminCookie), 403);
  await expectError(await call("/staff/assignments", "GET"), 401);
  await expectError(await call("/staff/assignments", "GET", undefined, customerCookie), 403);

  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: acceptedBooking, ...valid }), 401);
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: acceptedBooking, ...valid }, customerCookie), 403);
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: acceptedBooking, ...valid }, staffOneCookie), 403);
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: acceptedBooking, ...valid }, otherAdminCookie), 403);
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: randomUUID(), ...valid }, adminCookie), 404);
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: pendingBooking, ...valid }, adminCookie), 409);

  for (const invalid of [
    { ...valid, day: "2099-05-19" },
    { ...valid, endsAt: valid.startsAt },
    { ...valid, startsAt: "not-a-date" },
    { ...valid, day: "2099-02-30" },
  ]) {
    await expectError(await call("/admin/event-days", "POST", { bookingRequestId: acceptedBooking, ...invalid }, adminCookie), 400);
  }
  await expectError(await call("/admin/event-days", "POST", {
    bookingRequestId: acceptedBooking,
    ...schedule({ staffingStatus: "open", daysBefore: null }),
  }, adminCookie), 400);
  await expectError(await call("/admin/event-days", "POST", {
    bookingRequestId: acceptedBooking,
    ...schedule({ staffingStatus: "open" }), daysBefore: 5,
  }, adminCookie), 400);

  const draft = await createEventDay(acceptedBooking, valid);
  assert.equal(draft.day, "2099-05-20");
  assert.equal(draft.startsAt, "2099-05-20T12:00:00.000Z");
  assert.equal(draft.endsAt, "2099-05-20T18:00:00.000Z");
  assert.equal(draft.status, "scheduled");
  assert.equal(draft.staffingStatus, "draft");
  const draftId = dayId(draft);
  const hiddenDrafts = eventDays(await read(await call("/staff/event-days", "GET", undefined, staffOneCookie), 200));
  assert.ok(!hiddenDrafts.some((day) => day.id === draftId));

  const opened = await createEventDay(acceptedBooking, schedule({
    day: "2099-05-21",
    startsAt: "2099-05-21T10:00:00+08:00",
    endsAt: "2099-05-21T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const openedId = dayId(opened);
  const staffOpenDays = eventDays(await read(await call("/staff/event-days", "GET", undefined, staffOneCookie), 200));
  assert.ok(staffOpenDays.some((day) => day.id === openedId));
  const staffView = staffOpenDays.find((day) => day.id === openedId);
  assert.ok(staffView);
  assert.deepEqual(staffView.availability, []);
  assert.deepEqual(staffView.eligibleStaff, []);
  assert.equal(staffView.ownAvailability, null);
  assert.equal(staffView.ownAssignment, null);
  for (const privateField of ["customerId", "contactName", "phoneNumber", "specialRequests", "statusHistory", "bookingRequest"]) {
    assert.equal(privateField in staffView, false, `staff event day must omit ${privateField}`);
  }
  assert.equal((await rowCount("SELECT id FROM events_day WHERE id = $1 AND booking_request_id = $2", [openedId, acceptedBooking])), 1);

  await pool?.query("UPDATE events_day SET availability_deadline = now() - interval '1 second' WHERE id = $1", [openedId]);
  await expectError(await call(`/staff/event-days/${openedId}/availability`, "PUT", { response: "available" }, staffOneCookie), 409);
  const expired = eventDays(await read(await call("/staff/event-days", "GET", undefined, staffOneCookie), 200))
    .find((day) => day.id === openedId);
  assert.ok(expired);
  assert.equal(expired.staffingStatus, "closed");

  assert.equal(await rowCount("SELECT id FROM event_staff_availability WHERE event_day_id = $1", [openedId]), 0);
  const booking = await pool?.query<{ status: string }>("SELECT status FROM booking_requests WHERE id = $1", [acceptedBooking]);
  assert.equal(booking?.rows[0]?.status, "accepted");
});

test("availability is distinct and repeatable, and only available staff can be assigned after closing", async () => {
  const bookingRequestId = await createBooking();
  const day = await createEventDay(bookingRequestId);
  const id = dayId(day);
  assert.ok(!eventDays(await read(await call("/staff/event-days", "GET", undefined, staffOneCookie), 200)).some((row) => row.id === id));
  await expectError(await call(`/staff/event-days/${id}/availability`, "PUT", { response: "available" }, staffOneCookie), 409);
  await expectError(await call(`/admin/event-days/${id}/assignments/${staffOneId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);

  await setStaffing(id, "open", 2);
  const firstResponse = await respond(id, "available", staffOneCookie);
  assert.equal(firstResponse.ownAvailability, "available");
  await respond(id, "available", staffOneCookie);
  const unavailableResponse = await respond(id, "unavailable", staffTwoCookie);
  assert.equal(unavailableResponse.ownAvailability, "unavailable");
  assert.equal(await rowCount("SELECT id FROM event_staff_availability WHERE event_day_id = $1", [id]), 2);

  const adminOpen = eventDays(await read(await call(`/admin/event-days?bookingRequestId=${bookingRequestId}`, "GET", undefined, adminCookie), 200))
    .find((row) => row.id === id);
  assert.ok(adminOpen);
  const responses = arrayField(adminOpen, "availability").map((value) => asRecord(value, "availability response"));
  assert.equal(responses.length, 2);
  assert.equal(responses.find((entry) => entry.staffId === staffOneId)?.response, "available");
  assert.equal(responses.find((entry) => entry.staffId === staffTwoId)?.response, "unavailable");
  assert.equal(responses.some((entry) => entry.staffId === staffThreeId), false);
  const eligible = arrayField(adminOpen, "eligibleStaff").map((value) => asRecord(value, "eligible staff"));
  assert.ok(eligible.some((entry) => entry.id === staffOneId));
  assert.ok(!eligible.some((entry) => entry.id === customerId));
  assert.ok(!eligible.some((entry) => entry.id === adminId));

  await expectError(await call(`/admin/event-days/${id}/assignments/${staffOneId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);
  await setStaffing(id, "closed");
  await expectError(await call(`/admin/event-days/${id}/assignments/${staffThreeId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);
  await expectError(await call(`/admin/event-days/${id}/assignments/${staffTwoId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);
  await expectError(await call(`/admin/event-days/${id}/assignments/${customerId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);
  await expectError(await call(`/admin/event-days/${id}/assignments/${adminId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);

  const assigned = eventDay(await assign(id, staffOneId, "helper"));
  assert.equal(arrayField(assigned, "assignments").length, 1);
  const initialAssignment = asRecord(arrayField(assigned, "assignments")[0], "assignment");
  assert.equal(initialAssignment.staffId, staffOneId);
  assert.equal(initialAssignment.role, "helper");
  assert.equal(initialAssignment.status, "confirmed");
  await assign(id, staffOneId, "helper");
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND staff_id = $2", [id, staffOneId]), 1);

  await setStaffing(id, "open", 2);
  await expectError(await call(`/staff/event-days/${id}/availability`, "PUT", { response: "available" }, staffOneCookie), 409);
  await setStaffing(id, "closed");
  await assign(id, staffOneId, "helper", "cancelled");
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND staff_id = $2 AND status = 'cancelled'", [id, staffOneId]), 1);

  await setStaffing(id, "open", 2);
  const availableAgain = await respond(id, "available", staffOneCookie);
  assert.equal(availableAgain.ownAvailability, "available");
  await respond(id, "available", staffTwoCookie);
  await setStaffing(id, "closed");

  await assign(id, staffOneId, "coordinator");
  await expectError(await call(`/admin/event-days/${id}/assignments/${staffTwoId}`, "PUT", { role: "coordinator", status: "confirmed" }, adminCookie), 409);
  await assign(id, staffTwoId, "helper");
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND role = 'coordinator' AND status = 'confirmed'", [id]), 1);
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND status = 'confirmed'", [id]), 2);

  const staffAssignments = eventDays(await read(await call("/staff/assignments", "GET", undefined, staffOneCookie), 200));
  const ownDay = staffAssignments.find((row) => row.id === id);
  assert.ok(ownDay);
  assert.equal(ownDay.ownAssignment && asRecord(ownDay.ownAssignment, "own assignment").role, "coordinator");
  assert.deepEqual(ownDay.availability, []);
  assert.deepEqual(ownDay.eligibleStaff, []);
  const secondStaffDay = eventDays(await read(await call("/staff/event-days", "GET", undefined, staffTwoCookie), 200))
    .find((row) => row.id === id);
  assert.ok(secondStaffDay);
  const visibleAssignments = arrayField(secondStaffDay, "assignments").map((value) => asRecord(value, "assignment"));
  assert.deepEqual(visibleAssignments.map((row) => row.staffId).sort(), [staffOneId, staffTwoId].sort());
  assert.equal(secondStaffDay.ownAssignment && asRecord(secondStaffDay.ownAssignment, "own assignment").role, "helper");
});

test("overlapping assignments serialize for one staff member while adjacent ranges are both allowed", async () => {
  const firstBookingId = await createBooking();
  const secondBookingId = await createBooking();
  const first = await createEventDay(firstBookingId, schedule({
    day: "2099-05-20",
    startsAt: "2099-05-20T22:00:00+08:00",
    endsAt: "2099-05-21T02:00:00+08:00",
  }));
  const second = await createEventDay(secondBookingId, schedule({
    day: "2099-05-21",
    startsAt: "2099-05-21T01:00:00+08:00",
    endsAt: "2099-05-21T03:00:00+08:00",
  }));
  const firstId = dayId(first);
  const secondId = dayId(second);
  assert.notEqual(first.bookingRequestId, second.bookingRequestId);

  for (const id of [firstId, secondId]) {
    await setStaffing(id, "open", 2);
    await respond(id, "available", staffOneCookie);
    await setStaffing(id, "closed");
  }

  const competing = await Promise.all([
    call(`/admin/event-days/${firstId}/assignments/${staffOneId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie),
    call(`/admin/event-days/${secondId}/assignments/${staffOneId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie),
  ]);
  assert.deepEqual(competing.map((response) => response.status).sort((a, b) => a - b), [200, 409]);
  for (const response of competing) {
    if (response.status === 200) await read(response, 200);
    else await expectError(response, 409);
  }
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE staff_id = $1 AND status = 'confirmed' AND event_day_id = ANY($2::uuid[])", [staffOneId, [firstId, secondId]]), 1);

  const adjacentBookingId = await createBooking();
  const adjacentOne = await createEventDay(adjacentBookingId, schedule({
    day: "2099-05-22",
    startsAt: "2099-05-22T10:00:00+08:00",
    endsAt: "2099-05-22T12:00:00+08:00",
  }));
  const adjacentTwo = await createEventDay(adjacentBookingId, schedule({
    day: "2099-05-22",
    startsAt: "2099-05-22T12:00:00+08:00",
    endsAt: "2099-05-22T14:00:00+08:00",
  }));
  const adjacentIds = [dayId(adjacentOne), dayId(adjacentTwo)];
  for (const id of adjacentIds) {
    await setStaffing(id, "open", 2);
    await respond(id, "available", staffTwoCookie);
    await setStaffing(id, "closed");
    await assign(id, staffTwoId, "helper");
  }
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE staff_id = $1 AND status = 'confirmed' AND event_day_id = ANY($2::uuid[])", [staffTwoId, adjacentIds]), 2);
});

test("cancellation closes the day and retains responses while movement links one unstaffed replacement", async () => {
  const cancelBookingId = await createBooking();
  const cancellable = await createEventDay(cancelBookingId, schedule({
    day: "2099-06-10",
    startsAt: "2099-06-10T10:00:00+08:00",
    endsAt: "2099-06-10T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const cancellableId = dayId(cancellable);
  await respond(cancellableId, "available", staffOneCookie);
  await setStaffing(cancellableId, "closed");
  await assign(cancellableId, staffOneId, "coordinator");
  await setStaffing(cancellableId, "open", 2);

  const cancelled = eventDay(await read(await call(`/admin/event-days/${cancellableId}/cancel`, "POST", undefined, adminCookie), 200));
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.staffingStatus, "closed");
  assert.equal(arrayField(cancelled, "availability").length, 1);
  assert.equal(arrayField(cancelled, "assignments").length, 1);
  assert.equal(asRecord(arrayField(cancelled, "assignments")[0], "cancelled assignment").status, "cancelled");
  assert.equal(await rowCount("SELECT id FROM event_staff_availability WHERE event_day_id = $1", [cancellableId]), 1);
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND status = 'confirmed'", [cancellableId]), 0);
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND status = 'cancelled'", [cancellableId]), 1);
  const cancelledStaffDay = eventDays(await read(await call("/staff/event-days", "GET", undefined, staffOneCookie), 200))
    .find((row) => row.id === cancellableId);
  assert.ok(cancelledStaffDay);
  assert.equal(asRecord(cancelledStaffDay.ownAssignment, "own cancelled assignment").status, "cancelled");
  assert.deepEqual(cancelledStaffDay.availability, []);
  assert.equal(asRecord(arrayField(cancelledStaffDay, "assignments")[0], "visible cancelled assignment").status, "cancelled");
  await expectError(await call(`/admin/event-days/${cancellableId}/staffing`, "PATCH", { staffingStatus: "open", daysBefore: 2 }, adminCookie), 409);

  const moveBookingId = await createBooking();
  const original = await createEventDay(moveBookingId, schedule({
    day: "2099-06-11",
    startsAt: "2099-06-11T10:00:00+08:00",
    endsAt: "2099-06-11T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const originalId = dayId(original);
  await respond(originalId, "available", staffTwoCookie);
  await setStaffing(originalId, "closed");
  await assign(originalId, staffTwoId, "helper");
  await setStaffing(originalId, "open", 2);
  const replacementSchedule = schedule({
    day: "2099-06-12",
    startsAt: "2099-06-12T10:00:00+08:00",
    endsAt: "2099-06-12T12:00:00+08:00",
  });
  const replacement = eventDay(await read(await call(`/admin/event-days/${originalId}/move`, "POST", replacementSchedule, adminCookie), 200));
  const replacementId = dayId(replacement);
  assert.equal(replacement.bookingRequestId, moveBookingId);
  assert.equal(replacement.status, "scheduled");
  assert.equal(replacement.replacementEventDayId, null);
  assert.equal(replacement.staffingStatus, "draft");
  assert.deepEqual(replacement.availability, []);
  assert.deepEqual(replacement.assignments, []);

  const originalAfterMove = eventDays(await read(await call(`/admin/event-days?bookingRequestId=${moveBookingId}`, "GET", undefined, adminCookie), 200))
    .find((row) => row.id === originalId);
  assert.ok(originalAfterMove);
  assert.equal(originalAfterMove.status, "moved");
  assert.equal(originalAfterMove.staffingStatus, "closed");
  assert.equal(originalAfterMove.replacementEventDayId, replacementId);
  assert.equal(arrayField(originalAfterMove, "availability").length, 1);
  assert.equal(asRecord(arrayField(originalAfterMove, "assignments")[0], "cancelled assignment").status, "cancelled");
  const movedStaffDay = eventDays(await read(await call("/staff/event-days", "GET", undefined, staffTwoCookie), 200))
    .find((row) => row.id === originalId);
  assert.ok(movedStaffDay);
  assert.equal(movedStaffDay.status, "moved");
  assert.equal(asRecord(movedStaffDay.ownAssignment, "own moved assignment").status, "cancelled");
  assert.deepEqual(movedStaffDay.availability, []);
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id = $1", [moveBookingId]), 2);
  assert.equal(await rowCount("SELECT id FROM event_staff_availability WHERE event_day_id = $1", [replacementId]), 0);
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1", [replacementId]), 0);
  await expectError(await call(`/admin/event-days/${originalId}/move`, "POST", replacementSchedule, adminCookie), 409);
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id = $1", [moveBookingId]), 2);
  const statuses = await pool?.query<{ status: string }>(
    "SELECT status FROM booking_requests WHERE id = ANY($1::uuid[]) ORDER BY status",
    [[cancelBookingId, moveBookingId]],
  );
  assert.deepEqual(statuses?.rows.map((row) => row.status), ["accepted", "accepted"]);
});

test("customer and admin booking cancellation end every scheduled day and release confirmed staff", async () => {
  const customerBookingId = await createBooking();
  const customerDayOne = await createEventDay(customerBookingId, schedule({
    day: "2099-07-01",
    startsAt: "2099-07-01T10:00:00+08:00",
    endsAt: "2099-07-01T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const customerDayOneId = dayId(customerDayOne);
  await respond(customerDayOneId, "available", staffOneCookie);
  await setStaffing(customerDayOneId, "closed");
  await assign(customerDayOneId, staffOneId, "helper");

  const customerDayTwo = await createEventDay(customerBookingId, schedule({
    day: "2099-07-02",
    startsAt: "2099-07-02T10:00:00+08:00",
    endsAt: "2099-07-02T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const customerDayTwoId = dayId(customerDayTwo);
  await respond(customerDayTwoId, "unavailable", staffTwoCookie);

  const customerCancelledBody = await read(
    await call(`/booking-requests/${customerBookingId}/cancel`, "PATCH", { reason: "Customer change" }, customerCookie),
    200,
  );
  const customerCancelled = asRecord(asRecord(customerCancelledBody, "customer cancellation response").bookingRequest, "booking request");
  assert.equal(customerCancelled.status, "cancelled");
  const customerDays = await listBookingEventDays(customerBookingId);
  assert.equal(customerDays.length, 2);
  assert.ok(customerDays.every((day) => day.status === "cancelled" && day.staffingStatus === "closed"));
  const cancelledCustomerDayOne = customerDays.find((day) => day.id === customerDayOneId);
  const cancelledCustomerDayTwo = customerDays.find((day) => day.id === customerDayTwoId);
  assert.ok(cancelledCustomerDayOne);
  assert.ok(cancelledCustomerDayTwo);
  assert.equal(arrayField(cancelledCustomerDayOne, "assignments").length, 1);
  assert.equal(asRecord(arrayField(cancelledCustomerDayOne, "assignments")[0], "assignment").status, "cancelled");
  assert.equal(arrayField(cancelledCustomerDayOne, "availability").length, 1);
  assert.equal(arrayField(cancelledCustomerDayTwo, "availability").length, 1);
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id = $1 AND status = 'scheduled'", [customerBookingId]), 0);
  assert.equal(await rowCount("SELECT s.id FROM event_staffs s JOIN events_day d ON d.id = s.event_day_id WHERE d.booking_request_id = $1 AND s.status = 'confirmed'", [customerBookingId]), 0);
  assert.equal(await rowCount("SELECT a.id FROM event_staff_availability a JOIN events_day d ON d.id = a.event_day_id WHERE d.booking_request_id = $1", [customerBookingId]), 2);

  const adminBookingId = await createBooking();
  const movedSource = await createEventDay(adminBookingId, schedule({
    day: "2099-07-05",
    startsAt: "2099-07-05T10:00:00+08:00",
    endsAt: "2099-07-05T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const movedSourceId = dayId(movedSource);
  await respond(movedSourceId, "available", staffTwoCookie);
  await setStaffing(movedSourceId, "closed");
  await assign(movedSourceId, staffTwoId, "coordinator");
  const replacement = eventDay(await read(await call(`/admin/event-days/${movedSourceId}/move`, "POST", schedule({
    day: "2099-07-06",
    startsAt: "2099-07-06T10:00:00+08:00",
    endsAt: "2099-07-06T12:00:00+08:00",
  }), adminCookie), 200));
  const replacementId = dayId(replacement);
  await setStaffing(replacementId, "open", 2);
  await respond(replacementId, "available", staffThreeCookie);
  await setStaffing(replacementId, "closed");
  await assign(replacementId, staffThreeId, "helper");

  const adminDay = await createEventDay(adminBookingId, schedule({
    day: "2099-07-07",
    startsAt: "2099-07-07T10:00:00+08:00",
    endsAt: "2099-07-07T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const adminDayId = dayId(adminDay);
  await respond(adminDayId, "available", staffOneCookie);
  await setStaffing(adminDayId, "closed");
  await assign(adminDayId, staffOneId, "helper");

  const adminCancelled = await updateBookingStatus(adminBookingId, "cancelled", "Operations cancelled the event");
  assert.equal(adminCancelled.status, "cancelled");
  const adminDays = await listBookingEventDays(adminBookingId);
  const unchangedSource = adminDays.find((day) => day.id === movedSourceId);
  const cancelledReplacement = adminDays.find((day) => day.id === replacementId);
  const cancelledAdminDay = adminDays.find((day) => day.id === adminDayId);
  assert.ok(unchangedSource);
  assert.ok(cancelledReplacement);
  assert.ok(cancelledAdminDay);
  assert.equal(unchangedSource.status, "moved");
  assert.equal(unchangedSource.replacementEventDayId, replacementId);
  assert.equal(unchangedSource.staffingStatus, "closed");
  assert.equal(cancelledReplacement.status, "cancelled");
  assert.equal(cancelledReplacement.replacementEventDayId, null);
  assert.equal(cancelledReplacement.staffingStatus, "closed");
  assert.equal(cancelledAdminDay.status, "cancelled");
  assert.ok(adminDays.every((day) => day.status !== "scheduled"));
  assert.equal(arrayField(unchangedSource, "availability").length, 1);
  assert.equal(asRecord(arrayField(unchangedSource, "assignments")[0], "moved assignment").status, "cancelled");
  assert.equal(arrayField(cancelledReplacement, "availability").length, 1);
  assert.equal(asRecord(arrayField(cancelledReplacement, "assignments")[0], "replacement assignment").status, "cancelled");
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id = $1 AND status = 'scheduled'", [adminBookingId]), 0);
  assert.equal(await rowCount("SELECT s.id FROM event_staffs s JOIN events_day d ON d.id = s.event_day_id WHERE d.booking_request_id = $1 AND s.status = 'confirmed'", [adminBookingId]), 0);
  assert.equal(await rowCount("SELECT a.id FROM event_staff_availability a JOIN events_day d ON d.id = a.event_day_id WHERE d.booking_request_id = $1", [adminBookingId]), 3);
});

test("a needs-details booking allows staffing cleanup while rejecting new scheduling and confirmation", async () => {
  const bookingRequestId = await createBooking();
  const formerStaff = await createUser("staff", "Former Staff", "Event Staff");
  const assignmentDay = await createEventDay(bookingRequestId, schedule({
    day: "2099-08-01",
    startsAt: "2099-08-01T10:00:00+08:00",
    endsAt: "2099-08-01T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const assignmentDayId = dayId(assignmentDay);
  await respond(assignmentDayId, "available", formerStaff.cookie);
  await setStaffing(assignmentDayId, "closed");
  await assign(assignmentDayId, formerStaff.id, "coordinator");

  const cancelDay = await createEventDay(bookingRequestId, schedule({
    day: "2099-08-02",
    startsAt: "2099-08-02T10:00:00+08:00",
    endsAt: "2099-08-02T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const cancelDayId = dayId(cancelDay);
  await respond(cancelDayId, "available", staffOneCookie);
  await respond(cancelDayId, "available", staffTwoCookie);
  await setStaffing(cancelDayId, "closed");
  await assign(cancelDayId, staffTwoId, "helper");

  const needsDetails = await updateBookingStatus(bookingRequestId, "needs_details", "Awaiting customer details");
  assert.equal(needsDetails.status, "needs_details");
  await pool?.query("UPDATE users SET role = 'customer' WHERE id = $1", [formerStaff.id]);
  await assign(assignmentDayId, formerStaff.id, "coordinator", "cancelled");
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND staff_id = $2 AND status = 'cancelled'", [assignmentDayId, formerStaff.id]), 1);
  const cleanedDay = (await listBookingEventDays(bookingRequestId)).find((day) => day.id === assignmentDayId);
  assert.ok(cleanedDay);
  assert.equal(cleanedDay.status, "scheduled");
  assert.equal(cleanedDay.staffingStatus, "closed");
  assert.equal(asRecord(arrayField(cleanedDay, "assignments")[0], "cleaned assignment").status, "cancelled");

  await expectError(await call(`/admin/event-days/${cancelDayId}/staffing`, "PATCH", { staffingStatus: "open", daysBefore: 2 }, adminCookie), 409);
  await expectError(await call(`/staff/event-days/${cancelDayId}/availability`, "PUT", { response: "available" }, staffOneCookie), 409);
  await expectError(await call(`/admin/event-days/${cancelDayId}/assignments/${staffOneId}`, "PUT", { role: "helper", status: "confirmed" }, adminCookie), 409);
  await expectError(await call(`/admin/event-days/${cancelDayId}/move`, "POST", schedule({
    day: "2099-08-03",
    startsAt: "2099-08-03T10:00:00+08:00",
    endsAt: "2099-08-03T12:00:00+08:00",
  }), adminCookie), 409);
  await expectError(await call("/admin/event-days", "POST", {
    bookingRequestId,
    ...schedule({
      day: "2099-08-04",
      startsAt: "2099-08-04T10:00:00+08:00",
      endsAt: "2099-08-04T12:00:00+08:00",
    }),
  }, adminCookie), 409);

  const cancelledDay = eventDay(await read(await call(`/admin/event-days/${cancelDayId}/cancel`, "POST", undefined, adminCookie), 200));
  assert.equal(cancelledDay.status, "cancelled");
  assert.equal(cancelledDay.staffingStatus, "closed");
  assert.equal(asRecord(arrayField(cancelledDay, "assignments")[0], "cancelled nonaccepted assignment").status, "cancelled");
  assert.equal(await rowCount("SELECT id FROM event_staffs WHERE event_day_id = $1 AND status = 'confirmed'", [cancelDayId]), 0);
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id = $1 AND status = 'scheduled'", [bookingRequestId]), 1);
});

test("availability rechecks its deadline after waiting for the staff row lock", async () => {
  const bookingRequestId = await createBooking();
  const deadline = new Date(Date.now() + 1800).toISOString();
  const day = await createEventDay(bookingRequestId, schedule({
    day: "2099-09-01",
    startsAt: "2099-09-01T10:00:00+08:00",
    endsAt: "2099-09-01T12:00:00+08:00",
    staffingStatus: "open",
    daysBefore: 2,
  }));
  const id = dayId(day);
  await pool?.query("UPDATE events_day SET availability_deadline=$2 WHERE id=$1", [id, deadline]);
  const deadlineAt = Date.parse(deadline);
  assert.ok(Date.now() < deadlineAt, "the response request must begin before its deadline");

  const activePool = pool;
  assert.ok(activePool);
  const blocker = await activePool.connect();
  let request: Promise<Response> | undefined;
  let committed = false;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [staffOneId]);
    const blockerProcess = await blocker.query<{ pid: number }>("SELECT pg_backend_pid()::int AS pid");
    const blockerPid = blockerProcess.rows[0]?.pid;
    assert.ok(blockerPid);
    request = call(`/staff/event-days/${id}/availability`, "PUT", { response: "available" }, staffOneCookie);
    await waitForStaffLockWait(blockerPid, staffOneId);
    assert.ok(Date.now() < deadlineAt, "the availability request must be blocked before its deadline");
    await waitUntil(deadlineAt + 25);
    await blocker.query("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      await blocker.query("ROLLBACK");
      if (request) {
        const abandoned = await request;
        await abandoned.arrayBuffer();
      }
    }
    blocker.release();
  }

  assert.ok(request);
  await expectError(await request, 409);
  assert.equal(await rowCount("SELECT id FROM event_staff_availability WHERE event_day_id = $1 AND staff_id = $2", [id, staffOneId]), 0);
});

test("event-day routes are present in the generated OpenAPI document", async () => {
  const response = await app.request("/openapi.json");
  const spec = asRecord(await response.json(), "OpenAPI document");
  const paths = asRecord(spec.paths, "OpenAPI paths");
  const expectedMethods: ReadonlyArray<readonly [string, string]> = [
    ["/v1/admin/event-days", "get"],
    ["/v1/admin/event-days", "post"],
    ["/v1/admin/event-days/apply-response-deadlines", "post"],
    ["/v1/staff/event-days", "get"],
    ["/v1/staff/assignments", "get"],
    ["/v1/staff/event-days/{id}/availability", "put"],
    ["/v1/admin/event-days/{id}/staffing", "patch"],
    ["/v1/admin/event-days/{id}/assignments/{staffId}", "put"],
    ["/v1/admin/event-days/{id}/cancel", "post"],
    ["/v1/admin/event-days/{id}/move", "post"],
  ];
  for (const [path, method] of expectedMethods) {
    assert.ok(path in paths, `OpenAPI must include ${path}`);
    const operations = asRecord(paths[path], path);
    assert.ok(method in operations, `OpenAPI must include ${method.toUpperCase()} ${path}`);
  }
});


async function requestedBooking(status: "accepted" | "under_review" = "accepted") {
  const bookingId = await createBooking(status);
  assert.ok(pool);
  await pool.query("UPDATE booking_requests SET requested_days=$2::jsonb WHERE id=$1",[bookingId,JSON.stringify([
    {date:"2099-05-20",startsAt:null,endsAt:null},
    {date:"2099-05-22",startsAt:null,endsAt:null},
  ])]);
  return bookingId;
}
async function getRequestedBooking(id: string) {
  return asRecord(asRecord(await read(await call(`/booking-requests/${id}`,"GET",undefined,customerCookie),200),"response").bookingRequest,"booking");
}
async function saveRequestedTimes(id: string, revision: string, overrides: Partial<Schedule> = {}) {
  const input = schedule(overrides);
  return call(`/booking-requests/${id}/requested-days/${input.day}/times`,"PATCH",{
    startsAt:input.startsAt,endsAt:input.endsAt,expectedUpdatedAt:revision,
  },customerCookie);
}

function applyDeadlines(bookingRequestId: string, expectedUpdatedAt: string, daysBefore: ResponseDeadlineDays = 2) {
  return call("/admin/event-days/apply-response-deadlines", "POST", { bookingRequestId, daysBefore, expectedUpdatedAt }, adminCookie);
}
async function saveTimesFor(id: string, day: string, start = "10:00:00", end = "12:00:00") {
  const booking = await getRequestedBooking(id);
  return read(await saveRequestedTimes(id, stringField(booking, "updatedAt"), {
    day, startsAt: `${day}T${start}+08:00`, endsAt: `${day}T${end}+08:00`,
  }), 200);
}

test("batch deadlines use saved times, skip missing times, reject stale writes and retain moved and cancelled origins", async () => {
  const id = await requestedBooking("under_review");
  let booking = await getRequestedBooking(id);
  await expectError(await applyDeadlines(id, stringField(booking, "updatedAt")), 409);
  await saveTimesFor(id, "2099-05-20");
  booking = await getRequestedBooking(id);
  const beforeAccept = stringField(booking, "updatedAt");
  await updateBookingStatus(id, "accepted", undefined);
  await expectError(await applyDeadlines(id, beforeAccept), 409);
  booking = await getRequestedBooking(id);
  const revision = stringField(booking, "updatedAt");
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: id, ...schedule() }, adminCookie), 409);
  const simultaneous = await Promise.all([applyDeadlines(id, revision), applyDeadlines(id, revision)]);
  assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 409]);
  const success = simultaneous.find(response => response.status === 200); assert.ok(success);
  const [original] = eventDays(await read(success, 200)); assert.ok(original);
  const originalId = dayId(original);
  assert.equal(original.startsAt, "2099-05-20T02:00:00.000Z");
  assert.equal(original.endsAt, "2099-05-20T04:00:00.000Z");
  assert.equal(original.availabilityDeadline, "2099-05-18T15:59:59.999Z");
  assert.equal(original.staffingStatus, "open");
  booking = await getRequestedBooking(id);
  const requested = arrayField(booking, "requestedDays").map(value => asRecord(value, "requested day"));
  assert.equal(requested[0]?.eventDayId, originalId);
  assert.equal(requested[1]?.eventDayId, undefined);
  await expectError(await saveRequestedTimes(id, stringField(booking, "updatedAt")), 409);
  const moved = eventDay(await read(await call(`/admin/event-days/${originalId}/move`, "POST", schedule({
    day: "2099-05-21", startsAt: "2099-05-21T10:00:00+08:00", endsAt: "2099-05-21T12:00:00+08:00",
  }), adminCookie), 200));
  booking = await getRequestedBooking(id);
  await read(await applyDeadlines(id, stringField(booking, "updatedAt"), 3), 200);
  const days = await listBookingEventDays(id);
  assert.equal(days.find(day => day.id === originalId)?.availabilityDeadline, original.availabilityDeadline);
  assert.equal(days.find(day => day.id === dayId(moved))?.availabilityDeadline, "2099-05-18T15:59:59.999Z");
  assert.equal(days.find(day => day.id === dayId(moved))?.staffingStatus, "draft");
  booking = await getRequestedBooking(id);
  const linked = asRecord(arrayField(booking, "requestedDays")[0], "requested day");
  assert.equal(linked.eventDayId, originalId);
  assert.equal(asRecord(linked.operationalSchedule, "schedule").id, dayId(moved));
  await read(await call(`/admin/event-days/${dayId(moved)}/cancel`, "POST", undefined, adminCookie), 200);
  booking = await getRequestedBooking(id);
  await expectError(await applyDeadlines(id, stringField(booking, "updatedAt")), 409);
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id=$1", [id]), 2);
});

test("customer time saves and batch deadlines serialize without consuming stale times", async () => {
  const id = await requestedBooking();
  await saveTimesFor(id, "2099-05-20");
  const revision = stringField(await getRequestedBooking(id), "updatedAt");
  const results = await Promise.all([
    saveRequestedTimes(id, revision, { startsAt: "2099-05-20T11:00:00+08:00", endsAt: "2099-05-20T13:00:00+08:00" }),
    applyDeadlines(id, revision),
  ]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  const booking = await getRequestedBooking(id);
  const saved = asRecord(arrayField(booking, "requestedDays")[0], "requested day");
  const days = await listBookingEventDays(id);
  if (days.length) {
    assert.equal(saved.eventDayId, days[0]?.id);
    assert.equal(saved.startsAt, days[0]?.startsAt);
  } else {
    assert.equal(saved.startsAt, "2099-05-20T03:00:00.000Z");
    await expectError(await applyDeadlines(id, revision), 409);
  }
});

test("acceptance and saved times do not create operational days before applying deadlines", async () => {
  const id = await requestedBooking();
  let booking = await getRequestedBooking(id);
  await expectError(await applyDeadlines(id, stringField(booking, "updatedAt")), 409);
  await saveTimesFor(id, "2099-05-20");
  for (const path of ["/staff/event-days", "/staff/assignments"]) {
    const visible = eventDays(await read(await call(path, "GET", undefined, staffOneCookie), 200));
    assert.ok(!visible.some(day => day.bookingRequestId === id));
  }
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id=$1", [id]), 0);
});

test("cancellation and batch deadlines cannot leave scheduled days or consume stale revisions", async () => {
  const id = await requestedBooking();
  await saveTimesFor(id, "2099-05-20");
  const revision = stringField(await getRequestedBooking(id), "updatedAt");
  const [creation, cancellation] = await Promise.all([
    applyDeadlines(id, revision), call(`/booking-requests/${id}/cancel`, "PATCH", { reason: "Customer cancelled" }, customerCookie),
  ]);
  assert.ok([200, 409].includes(creation.status)); await read(cancellation, 200);
  assert.ok((await listBookingEventDays(id)).every(day => day.status === "cancelled"));
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id=$1 AND status='scheduled'", [id]), 0);
});

test("batch input and every opening route reject raw timestamps and unsupported offsets", async () => {
  const id = await requestedBooking();
  const revision = stringField(await getRequestedBooking(id), "updatedAt");
  const body = { bookingRequestId: id, daysBefore: 2, expectedUpdatedAt: revision };
  const path = "/admin/event-days/apply-response-deadlines";
  for (const [cookie, status] of [[undefined, 401], [customerCookie, 403], [staffOneCookie, 403], [otherAdminCookie, 403]] as const)
    await expectError(await call(path, "POST", body, cookie), status);
  for (const invalid of [
    { ...body, startsAt: schedule().startsAt }, { ...body, requestedDate: "2099-05-20" },
    { ...body, availabilityDeadline: futureDeadline() }, { ...body, expectedUpdatedAt: undefined },
    ...[0, 5, 1.5, "2", null].map(daysBefore => ({ ...body, daysBefore })),
  ]) await expectError(await call(path, "POST", invalid, adminCookie), 400);
  await expectError(await call(path, "POST", { ...body, bookingRequestId: randomUUID() }, adminCookie), 404);
  const legacy = await createBooking();
  const day = await createEventDay(legacy);
  await expectError(await call("/admin/event-days", "POST", { bookingRequestId: legacy, ...schedule(), availabilityDeadline: futureDeadline() }, adminCookie), 400);
  await expectError(await call(`/admin/event-days/${dayId(day)}/move`, "POST", { ...schedule(), availabilityDeadline: futureDeadline() }, adminCookie), 400);
  await expectError(await call(`/admin/event-days/${dayId(day)}/staffing`, "PATCH", { staffingStatus: "open", availabilityDeadline: futureDeadline() }, adminCookie), 400);
  await expectError(await call(`/admin/event-days/${dayId(day)}/staffing`, "PATCH", { staffingStatus: "open", daysBefore: 5 }, adminCookie), 400);
  assert.equal((await call("/admin/event-days/from-requested-day", "POST", body, adminCookie)).status, 404);
});

test("one batch offset applies to all ready dates, preserves closed windows, and advances revisions", async () => {
  const id = await requestedBooking();
  await saveTimesFor(id, "2099-05-20");
  const bookingBefore = await getRequestedBooking(id);
  await read(await saveRequestedTimes(id, stringField(bookingBefore, "updatedAt"), {
    day: "2099-05-22", startsAt: "2099-05-22T23:00:00+08:00", endsAt: "2099-05-23T02:00:00+08:00",
  }), 200);
  let booking = await getRequestedBooking(id);
  let days = eventDays(await read(await applyDeadlines(id, stringField(booking, "updatedAt")), 200));
  assert.equal(days.length, 2);
  assert.equal(days.find(day => day.day === "2099-05-22")?.endsAt, "2099-05-22T18:00:00.000Z");
  const closed = days[0], expired = days[1]; assert.ok(closed && expired);
  await setStaffing(dayId(closed), "closed");
  await pool?.query("UPDATE events_day SET availability_deadline=now()-interval '1 second' WHERE id=$1", [dayId(expired)]);
  booking = await getRequestedBooking(id);
  const revision = stringField(booking, "updatedAt");
  days = eventDays(await read(await applyDeadlines(id, revision, 4), 200));
  assert.ok(days.every(day => day.staffingStatus === "closed"));
  assert.equal(days.find(day => day.day === "2099-05-20")?.availabilityDeadline, "2099-05-16T15:59:59.999Z");
  assert.equal(days.find(day => day.day === "2099-05-22")?.availabilityDeadline, "2099-05-18T15:59:59.999Z");
  assert.notEqual((await getRequestedBooking(id)).updatedAt, revision);
  await expectError(await applyDeadlines(id, revision), 409);
  booking = await getRequestedBooking(id);
  await setStaffing(dayId(expired), "open", 1);
  await expectError(await applyDeadlines(id, stringField(booking, "updatedAt")), 409);
});

test("calendar deadline helper covers January examples, every choice, leap dates, DST, and skipped local dates", () => {
  assert.deepEqual(["2027-01-01", "2027-01-10", "2027-01-15"].map(day => responseDeadlineForDay(day, 2, "Asia/Manila")), [
    "2026-12-30T15:59:59.999Z", "2027-01-08T15:59:59.999Z", "2027-01-13T15:59:59.999Z",
  ]);
  for (const daysBefore of RESPONSE_DEADLINE_DAYS)
    assert.equal(responseDeadlineForDay("2027-01-10", daysBefore, "Asia/Manila"), `2027-01-0${10 - daysBefore}T15:59:59.999Z`);
  assert.equal(responseDeadlineForDay("2028-03-01", 1, "UTC"), "2028-02-29T23:59:59.999Z");
  assert.equal(responseDeadlineForDay("2027-03-01", 1, "UTC"), "2027-02-28T23:59:59.999Z");
  assert.equal(responseDeadlineForDay("2027-03-15", 1, "America/New_York"), "2027-03-15T03:59:59.999Z");
  assert.equal(responseDeadlineForDay("2027-11-08", 1, "America/New_York"), "2027-11-08T04:59:59.999Z");
  assert.throws(() => responseDeadlineForDay("2011-12-31", 1, "Pacific/Apia"), /valid local end time/);
  assert.throws(() => responseDeadlineForDay("2027-02-30", 1, "UTC"), /Invalid event date/);
});

test("a batch with an expired new opening rolls back every day and link", async () => {
  const id = await requestedBooking();
  assert.ok(pool);
  await pool.query("UPDATE booking_requests SET requested_days=$2::jsonb WHERE id=$1", [id, JSON.stringify([
    { date: "2099-05-20", startsAt: "2099-05-20T02:00:00Z", endsAt: "2099-05-20T04:00:00Z" },
    { date: "2000-01-10", startsAt: "2000-01-10T02:00:00Z", endsAt: "2000-01-10T04:00:00Z" },
  ])]);
  const before = await getRequestedBooking(id);
  assert.match(await expectError(await applyDeadlines(id, stringField(before, "updatedAt")), 400), /2000-01-10/);
  const after = await getRequestedBooking(id);
  assert.deepEqual(after.requestedDays, before.requestedDays);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal(await rowCount("SELECT id FROM events_day WHERE booking_request_id=$1", [id]), 0);
});


test("batch computes one calendar offset for three January dates and updates open windows without duplicates", async () => {
  const id = await requestedBooking();
  assert.ok(pool);
  await pool.query("UPDATE booking_requests SET requested_days=$2::jsonb WHERE id=$1", [id, JSON.stringify(
    ["2099-01-01", "2099-01-10", "2099-01-15"].map(date => ({ date, startsAt: `${date}T02:00:00Z`, endsAt: `${date}T04:00:00Z` })),
  )]);
  let booking = await getRequestedBooking(id);
  let days = eventDays(await read(await applyDeadlines(id, stringField(booking, "updatedAt"), 2), 200));
  assert.deepEqual(days.map(day => day.availabilityDeadline), ["2098-12-30T15:59:59.999Z", "2099-01-08T15:59:59.999Z", "2099-01-13T15:59:59.999Z"]);
  booking = await getRequestedBooking(id);
  days = eventDays(await read(await applyDeadlines(id, stringField(booking, "updatedAt"), 3), 200));
  assert.equal(days.length, 3);
  assert.ok(days.every(day => day.staffingStatus === "open"));
  assert.deepEqual(days.map(day => day.availabilityDeadline), ["2098-12-29T15:59:59.999Z", "2099-01-07T15:59:59.999Z", "2099-01-12T15:59:59.999Z"]);
});

test("an expired recomputation for an open day aborts pending creation and preserves every stored deadline", async () => {
  const id = await requestedBooking();
  await saveTimesFor(id, "2099-05-20");
  let booking = await getRequestedBooking(id);
  const [existing] = eventDays(await read(await applyDeadlines(id, stringField(booking, "updatedAt")), 200)); assert.ok(existing);
  await saveTimesFor(id, "2099-05-22");
  assert.ok(pool);
  await pool.query("UPDATE events_day SET day='2000-01-10', starts_at='2000-01-10T02:00:00Z', ends_at='2000-01-10T04:00:00Z' WHERE id=$1", [dayId(existing)]);
  booking = await getRequestedBooking(id);
  const before = await listBookingEventDays(id);
  await expectError(await applyDeadlines(id, stringField(booking, "updatedAt"), 4), 400);
  assert.deepEqual(await listBookingEventDays(id), before);
  assert.deepEqual((await getRequestedBooking(id)).requestedDays, booking.requestedDays);
  assert.equal((await getRequestedBooking(id)).updatedAt, booking.updatedAt);
});
