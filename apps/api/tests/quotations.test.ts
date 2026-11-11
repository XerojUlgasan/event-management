import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_quote_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let adminPool: Pool;
let pool: Pool;
let adminCookie: string;
let customerCookie: string;
let secondAdminCookie: string;
let otherCookie: string;
let customerId: string;
let packageId: string;

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
  adminPool = new Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        display_name: role,
        password_hash: "unused",
        role,
        staff_role: role === "admin" ? "System Administrator" : null,
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
    return { cookie: `em_session=${token}`, id: user.id };
  }
  adminCookie = (await session("admin")).cookie;
  secondAdminCookie = (await session("admin")).cookie;
  const customer = await session("customer");
  customerCookie = customer.cookie;
  customerId = customer.id;
  otherCookie = (await session("customer")).cookie;
  packageId = (
    await db
      .insertInto("packages")
      .values({
        slug: `quote-${randomUUID()}`,
        name: "Quotation package",
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
function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = adminCookie,
) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Cookie: cookie,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
async function booking(selectedPackageId = packageId) {
  const id = randomUUID();
  await db
    .insertInto("booking_requests")
    .values({
      id,
      reference: `Q-${id}`,
      customer_id: customerId,
      package_id: selectedPackageId,
      package_name: "Quotation package",
      package_price: 1000,
      package_max_guests: 100,
      event_type: "Wedding",
      preferred_date: "2099-01-01",
      requested_days: JSON.stringify([
        { date: "2099-01-01", startsAt: null, endsAt: null },
        { date: "2099-01-03", startsAt: null, endsAt: null },
      ]),
      time_zone: "Asia/Manila",
      contact_name: "Customer",
      phone_number: "123",
      out_of_range: false,
    })
    .execute();
  await db
    .insertInto("conversations")
    .values({ booking_request_id: id, customer_id: customerId })
    .execute();
  return (
    await read(
      await call(`/booking-requests/${id}`, "GET", undefined, customerCookie),
      200,
    )
  ).bookingRequest;
}
async function create(b: any) {
  return (
    await read(
      await call(`/admin/booking-requests/${b.id}/quotations`, "POST", {
        expectedUpdatedAt: b.updatedAt,
      }),
      201,
    )
  ).quotation;
}

test("empty quotation delivery, ownership, acceptance, revision and history", async () => {
  const b = await booking();
  let q = await create(b);
  assert.deepEqual(q.items, []);
  assert.equal(q.totalAmountMinor, 100000);
  assert.deepEqual(
    (
      await read(
        await call(
          `/booking-requests/${b.id}/quotations`,
          "GET",
          undefined,
          customerCookie,
        ),
        200,
      )
    ).quotations,
    [],
  );
  assert.equal(
    (await call(`/quotations/${q.id}`, "GET", undefined, otherCookie)).status,
    404,
  );
  const stale = q.updatedAt;
  q = (
    await read(
      await call(`/admin/quotations/${q.id}`, "PATCH", {
        expectedUpdatedAt: q.updatedAt,
        items: [],
      }),
      200,
    )
  ).quotation;
  assert.equal(
    (
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: stale,
      })
    ).status,
    409,
  );
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  const msg = await db
    .selectFrom("messages")
    .selectAll()
    .where("quotation_id", "=", q.id)
    .execute();
  assert.equal(msg.length, 1);
  assert.equal(
    (
      await call(
        `/quotations/${q.id}/accept`,
        "POST",
        { expectedUpdatedAt: q.updatedAt },
        otherCookie,
      )
    ).status,
    404,
  );
  q = (
    await read(
      await call(
        `/quotations/${q.id}/accept`,
        "POST",
        { expectedUpdatedAt: q.updatedAt },
        customerCookie,
      ),
      200,
    )
  ).quotation;
  assert.equal(q.status, "accepted");
  assert.deepEqual(
    await read(
      await call(
        `/quotations/${q.id}/revision`,
        "POST",
        { expectedUpdatedAt: q.updatedAt, reason: "Change terms" },
        customerCookie,
      ),
      201,
    ),
    { ok: true },
  );
  assert.equal(
    (
      await db
        .selectFrom("quotations")
        .select("status")
        .where("id", "=", q.id)
        .executeTakeFirstOrThrow()
    ).status,
    "superseded",
  );
  const history = (
    await read(
      await call(
        `/booking-requests/${b.id}/quotations`,
        "GET",
        undefined,
        customerCookie,
      ),
      200,
    )
  ).quotations;
  assert.equal(history.length, 1);
  assert.equal(
    (
      await db
        .selectFrom("booking_requests")
        .select("status")
        .where("id", "=", b.id)
        .executeTakeFirstOrThrow()
    ).status,
    "under_review",
  );
  assert.equal(
    (
      await db
        .selectFrom("events_day")
        .select("id")
        .where("booking_request_id", "=", b.id)
        .execute()
    ).length,
    0,
  );
});

test("item validation, arithmetic, concurrent stale writes and closed delivery", async () => {
  const b = await booking();
  let q = await create(b);
  const item = {
    id: randomUUID(),
    direction: "add",
    kind: "adjustment",
    description: "Extra",
    amountMinor: 2500,
    serviceId: null,
  };
  assert.equal(
    (
      await call(`/admin/quotations/${q.id}`, "PATCH", {
        expectedUpdatedAt: q.updatedAt,
        items: [{ ...item, serviceId: randomUUID() }],
      })
    ).status,
    400,
  );
  const responses = await Promise.all([
    call(`/admin/quotations/${q.id}`, "PATCH", {
      expectedUpdatedAt: q.updatedAt,
      items: [item],
    }),
    call(`/admin/quotations/${q.id}`, "PATCH", {
      expectedUpdatedAt: q.updatedAt,
      items: [item],
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  q = ((await responses.find((r) => r.status === 200)!.json()) as any)
    .quotation;
  assert.equal(q.totalAmountMinor, 102500);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("booking_request_id", "=", b.id)
    .execute();
  assert.equal(
    (
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await db
        .selectFrom("quotations")
        .select("status")
        .where("id", "=", q.id)
        .executeTakeFirstOrThrow()
    ).status,
    "draft",
  );
  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("quotation_id", "=", q.id)
        .execute()
    ).length,
    0,
  );
});

test("requested-day changes preserve the sent price and allow acceptance", async () => {
  const b = await booking();
  let q = await create(b);
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  await db
    .updateTable("booking_requests")
    .set({
      requested_days: JSON.stringify([
        {
          date: "2099-01-01",
          startsAt: "2099-01-01T01:00:00.000Z",
          endsAt: "2099-01-01T03:00:00.000Z",
        },
        { date: "2099-01-03", startsAt: null, endsAt: null },
      ]),
    })
    .where("id", "=", b.id)
    .execute();
  assert.equal(
    (
      await call(
        `/quotations/${q.id}/accept`,
        "POST",
        { expectedUpdatedAt: q.updatedAt },
        customerCookie,
      )
    ).status,
    200,
  );
});

test("another System Administrator edits, sends and revises with audit", async () => {
  const b = await booking();
  let q = await create(b);
  q = (
    await read(
      await call(
        `/admin/quotations/${q.id}`,
        "PATCH",
        { expectedUpdatedAt: q.updatedAt, items: [] },
        secondAdminCookie,
      ),
      200,
    )
  ).quotation;
  q = (
    await read(
      await call(
        `/admin/quotations/${q.id}/send`,
        "POST",
        { expectedUpdatedAt: q.updatedAt },
        secondAdminCookie,
      ),
      200,
    )
  ).quotation;
  const old = q.id;
  q = (
    await read(
      await call(
        `/admin/quotations/${q.id}/revision`,
        "POST",
        { expectedUpdatedAt: q.updatedAt, reason: "Review details" },
        secondAdminCookie,
      ),
      201,
    )
  ).quotation;
  assert.equal(q.previousQuotationId, old);
  assert.equal(q.adjustmentsReviewed, false);
  assert.equal(
    (
      await db
        .selectFrom("audit_events")
        .select("action")
        .where("entity_id", "in", [old, q.id])
        .execute()
    ).length,
    4,
  );
});

test("invalid service references fail and historical wording remains stable", async () => {
  const b = await booking();
  let q = await create(b);
  const service = await db
    .insertInto("services")
    .values({
      name: "Original wording",
      slug: `service-${randomUUID()}`,
      description: "Details",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const item = {
    id: randomUUID(),
    direction: "add",
    kind: "addition",
    description: "Original wording",
    amountMinor: 100,
    serviceId: service.id,
  };
  q = (
    await read(
      await call(`/admin/quotations/${q.id}`, "PATCH", {
        expectedUpdatedAt: q.updatedAt,
        items: [item],
      }),
      200,
    )
  ).quotation;
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  await db
    .updateTable("services")
    .set({ name: "Renamed", archived_at: new Date() })
    .where("id", "=", service.id)
    .execute();
  const displayed = (
    await read(
      await call(`/quotations/${q.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).quotation;
  assert.equal(displayed.items[0].description, "Original wording");
  const next = (
    await read(
      await call(`/admin/quotations/${q.id}/revision`, "POST", {
        expectedUpdatedAt: q.updatedAt,
        reason: "Review",
      }),
      201,
    )
  ).quotation;
  assert.equal(
    (
      await call(`/admin/quotations/${next.id}`, "PATCH", {
        expectedUpdatedAt: next.updatedAt,
        items: [item],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/quotations/${next.id}`, "PATCH", {
        expectedUpdatedAt: next.updatedAt,
        items: [{ ...item, serviceId: randomUUID() }],
      })
    ).status,
    400,
  );
});

test("message failure rolls back send status, message and audit", async () => {
  const b = await booking();
  const q = await create(b);
  await pool.query(
    "CREATE FUNCTION reject_quote_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.quotation_id IS NOT NULL THEN RAISE EXCEPTION 'test delivery failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_quote_test BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION reject_quote_test()",
  );
  try {
    assert.equal(
      (
        await call(`/admin/quotations/${q.id}/send`, "POST", {
          expectedUpdatedAt: q.updatedAt,
        })
      ).status,
      500,
    );
    assert.equal(
      (
        await db
          .selectFrom("quotations")
          .select("status")
          .where("id", "=", q.id)
          .executeTakeFirstOrThrow()
      ).status,
      "draft",
    );
    assert.equal(
      (
        await db
          .selectFrom("messages")
          .select("id")
          .where("quotation_id", "=", q.id)
          .execute()
      ).length,
      0,
    );
    assert.equal(
      (
        await db
          .selectFrom("audit_events")
          .select("id")
          .where("entity_id", "=", q.id)
          .where("action", "=", "quotation.sent")
          .execute()
      ).length,
      0,
    );
  } finally {
    await pool.query("DROP TRIGGER reject_quote_test ON messages");
    await pool.query("DROP FUNCTION reject_quote_test()");
  }
});

test("package and service changes preserve quoted amounts; revisions use the current price", async () => {
  const pkg = await db.insertInto("packages").values({
    name: "Financial history", slug: `financial-${randomUUID()}`, price: 1000, max_guests: 100,
  }).returning("id").executeTakeFirstOrThrow();
  const service = await db.insertInto("services").values({
    name: "Original service", slug: `financial-service-${randomUUID()}`, description: "Original coverage",
  }).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("package_services").values({ package_id: pkg.id, service_id: service.id, role: "included", sort_order: 0 }).execute();
  const b = await booking(pkg.id);
  let q = await create(b);
  const items = [{ id: randomUUID(), direction: "deduct", kind: "deduction", description: "Agreed discount", amountMinor: 20000, serviceId: null }];
  q = (await read(await call(`/admin/quotations/${q.id}`, "PATCH", { expectedUpdatedAt: q.updatedAt, items }), 200)).quotation;
  await db.updateTable("packages").set({ name: "Changed proposal", price: 1500, updated_at: new Date() }).where("id", "=", pkg.id).execute();
  await db.updateTable("services").set({ description: "Changed coverage", archived_at: new Date(), updated_at: new Date() }).where("id", "=", service.id).execute();
  q = (await read(await call(`/admin/quotations/${q.id}/send`, "POST", { expectedUpdatedAt: q.updatedAt }), 200)).quotation;
  q = (await read(await call(`/quotations/${q.id}/accept`, "POST", { expectedUpdatedAt: q.updatedAt }, customerCookie), 200)).quotation;
  assert.equal(q.baseAmountMinor, 100000);
  assert.equal(q.totalAmountMinor, 80000);
  assert.deepEqual(q.items, items);
  assert.equal(q.offeredPackageId, pkg.id);
  for (const field of ["offeredPackageUpdatedAt", "offeredPackageTerms", "basisCurrent"]) assert.equal(field in q, false);

  let revised = (await read(await call(`/admin/quotations/${q.id}/revision`, "POST", { expectedUpdatedAt: q.updatedAt, reason: "Offer the updated package price" }), 201)).quotation;
  assert.equal(revised.baseAmountMinor, 150000);
  assert.equal(revised.totalAmountMinor, 130000);
  assert.deepEqual(revised.items, items);
  assert.equal(revised.adjustmentsReviewed, false);
  assert.equal((await call(`/admin/quotations/${revised.id}/send`, "POST", { expectedUpdatedAt: revised.updatedAt })).status, 409);
  revised = (await read(await call(`/admin/quotations/${revised.id}`, "PATCH", { expectedUpdatedAt: revised.updatedAt, items }), 200)).quotation;
  await read(await call(`/admin/quotations/${revised.id}/send`, "POST", { expectedUpdatedAt: revised.updatedAt }), 200);
  const history = (await read(await call(`/booking-requests/${b.id}/quotations`, "GET", undefined, customerCookie), 200)).quotations;
  assert.equal(history[0].status, "sent");
  assert.equal(history[1].status, "superseded");
  assert.ok(history[1].supersededAt);
  assert.equal(history[1].baseAmountMinor, 100000);
  assert.equal(history[1].totalAmountMinor, 80000);
  assert.deepEqual(history[1].items, items);
  const audit = await db.selectFrom("audit_events").select("action").where("entity_id", "=", q.id).execute();
  assert(audit.some(row => row.action === "quotation.accepted"));
});

test("schedule and timezone changes do not block acceptance or alter saved amounts", async () => {
  const b = await booking();
  await db.updateTable("booking_requests").set({ requested_days: null, status: "accepted" }).where("id", "=", b.id).execute();
  const day = await db.insertInto("events_day").values({ booking_request_id: b.id, day: "2099-01-01", starts_at: new Date("2099-01-01T01:00:00Z"), ends_at: new Date("2099-01-01T03:00:00Z") }).returning("id").executeTakeFirstOrThrow();
  const latest = (await read(await call(`/booking-requests/${b.id}`, "GET", undefined, customerCookie), 200)).bookingRequest;
  let q = await create(latest);
  q = (await read(await call(`/admin/quotations/${q.id}/send`, "POST", { expectedUpdatedAt: q.updatedAt }), 200)).quotation;
  await db.updateTable("events_day").set({ status: "cancelled", staffing_status: "closed" }).where("id", "=", day.id).execute();
  await db.updateTable("booking_requests").set({ time_zone: "Asia/Tokyo" }).where("id", "=", b.id).execute();
  const accepted = (await read(await call(`/quotations/${q.id}/accept`, "POST", { expectedUpdatedAt: q.updatedAt }, customerCookie), 200)).quotation;
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.totalAmountMinor, q.totalAmountMinor);
});

test("private package edits remain visible separately while quotations retain their own amounts", async () => {
  const b = await booking();
  const before = await read(await call(`/admin/booking-requests/${b.id}/package`), 200);
  const content = { name: "Private proposal", description: "Current description", maxGuests: 100, price: { kind: "fixed", currency: "PHP", amountMinor: 120000 }, services: [], sections: [] };
  const custom = await read(await call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
    ...content, expectedUpdatedAt: before.package.updatedAt, expectedBookingUpdatedAt: before.bookingUpdatedAt,
  }), 200);
  let q = await create(custom.bookingRequest);
  assert.equal(q.offeredPackageId, custom.package.id);
  const edited = await read(await call(`/admin/booking-requests/${b.id}/custom-package`, "PATCH", {
    ...content, description: "Updated description", price: { kind: "fixed", currency: "PHP", amountMinor: 180000 }, expectedUpdatedAt: custom.package.updatedAt, expectedBookingUpdatedAt: custom.bookingRequest.updatedAt,
  }), 200);
  q = (await read(await call(`/admin/quotations/${q.id}/send`, "POST", { expectedUpdatedAt: q.updatedAt }), 200)).quotation;
  const current = await read(await call(`/booking-requests/${b.id}/package`, "GET", undefined, customerCookie), 200);
  assert.equal(current.package.description, "Updated description");
  assert.equal(current.package.price.amountMinor, 180000);
  assert.equal(q.totalAmountMinor, 120000);
  q = (await read(await call(`/quotations/${q.id}/accept`, "POST", { expectedUpdatedAt: q.updatedAt }, customerCookie), 200)).quotation;
  assert.equal(q.totalAmountMinor, 120000);
  assert.equal(edited.bookingRequest.packageId, b.packageId);
});
