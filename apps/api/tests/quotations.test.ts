import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  CatalogSection,
  PackageAddonService,
} from "@event-management/contracts/catalog";
import {
  MAX_QUOTATION_AMOUNT_MINOR,
  MAX_QUOTATION_DESCRIPTION_LENGTH,
  MAX_QUOTATION_ITEMS,
  type Quotation,
  type QuotationAddonItem,
  type QuotationPreparation,
  type SendQuotationInput,
} from "@event-management/contracts/quotations";
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
let adminId: string;
let packageId: string;

before(async () => {
  // Customer chat in this domain suite must not call the live AI provider.
  delete process.env.AI_GATEWAY_API_KEY;
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
  const admin = await session("admin");
  adminCookie = admin.cookie;
  adminId = admin.id;
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
      await adminPool.query(`DROP DATABASE IF EXISTS "${database}"`);
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

async function booking(selectedPackageId: string | null = packageId) {
  const id = randomUUID();
  await db
    .insertInto("booking_requests")
    .values({
      id,
      reference: `Q-${id}`,
      customer_id: customerId,
      package_id: selectedPackageId,
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

const quotationPath = (bookingId: string) =>
  `/admin/booking-requests/${bookingId}/quotations`;

async function prepare(bookingId: string): Promise<QuotationPreparation> {
  return (await read(await call(`${quotationPath(bookingId)}/prepare`), 200))
    .preparation;
}

function sendInput(
  prepared: QuotationPreparation,
  items: SendQuotationInput["items"] = [],
  revisionReason = prepared.currentOffer ? "Updated proposal" : null,
): SendQuotationInput {
  const {
    expectedBookingUpdatedAt,
    packageId,
    expectedPackageUpdatedAt,
    currentOffer,
  } = prepared;

  return {
    requestId: randomUUID(),
    expectedBookingUpdatedAt,
    packageId,
    expectedPackageUpdatedAt,
    currentOffer,
    revisionReason,
    items,
  };
}

function sendRequest(bookingId: string, input: unknown, cookie = adminCookie) {
  return call(`${quotationPath(bookingId)}/send`, "POST", input, cookie);
}

async function send(
  bookingId: string,
  input?: SendQuotationInput,
): Promise<Quotation> {
  return (
    await read(
      await sendRequest(
        bookingId,
        input ?? sendInput(await prepare(bookingId)),
      ),
      200,
    )
  ).quotation;
}

const proposalContent = {
  name: "Status matrix proposal",
  description: "Synthetic proposal without media",
  maxGuests: 50,
  price: { kind: "fixed", currency: "PHP", amountMinor: 100000 },
  sections: [],
};

type MatrixOperation = "send" | "scratch" | "copy" | "update" | "attach";

// Every operation gets its own booking and satisfies all non-status prerequisites.
async function matrixFixture(operation: MatrixOperation) {
  const b = await booking(
    ["scratch", "update", "attach"].includes(operation) ? null : packageId,
  );
  const input =
    operation === "send" ? sendInput(await prepare(b.id)) : undefined;
  let custom: any;

  if (operation === "update")
    custom = await read(
      await call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
        ...proposalContent,
        expectedBookingUpdatedAt: b.updatedAt,
      }),
      200,
    );

  const source =
    operation === "copy"
      ? await read(await call(`/admin/booking-requests/${b.id}/package`), 200)
      : undefined;
  const currentBooking = custom?.bookingRequest ?? b;

  const invoke = () => {
    switch (operation) {
      case "send":
        return sendRequest(b.id, input);
      case "scratch":
      case "copy":
        return call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
          ...proposalContent,
          expectedBookingUpdatedAt: currentBooking.updatedAt,
          ...(source ? { expectedUpdatedAt: source.package.updatedAt } : {}),
        });
      case "update":
        return call(`/admin/booking-requests/${b.id}/custom-package`, "PATCH", {
          ...proposalContent,
          description: "Updated synthetic proposal",
          expectedBookingUpdatedAt: currentBooking.updatedAt,
          expectedUpdatedAt: custom.package.updatedAt,
        });
      case "attach":
        return call(`/admin/booking-requests/${b.id}/package`, "POST", {
          packageId,
          expectedBookingUpdatedAt: currentBooking.updatedAt,
        });
    }
  };

  return { id: b.id, invoke };
}

// Include booking, proposals, quotations, conversation, messages and all audits;
// no other tests execute concurrently in this suite.
async function matrixSnapshot(id: string) {
  const result = await pool.query(
    `SELECT
      (SELECT row_to_json(b) FROM booking_requests b WHERE b.id = $1) AS booking,
      (SELECT coalesce(json_agg(p ORDER BY p.id), '[]') FROM packages p WHERE p.custom_for_booking_request_id = $1) AS proposals,
      (SELECT coalesce(json_agg(p ORDER BY p.id), '[]') FROM packages p WHERE p.package_type = 'catalog') AS catalog,
      (SELECT coalesce(json_agg(q ORDER BY q.id), '[]') FROM quotations q WHERE q.booking_request_id = $1) AS quotations,
      (SELECT coalesce(json_agg(c ORDER BY c.id), '[]') FROM conversations c WHERE c.booking_request_id = $1) AS conversations,
      (SELECT coalesce(json_agg(m ORDER BY m.id), '[]') FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.booking_request_id = $1) AS messages,
      (SELECT coalesce(json_agg(a ORDER BY a.id), '[]') FROM audit_events a) AS audits`,
    [id],
  );

  return result.rows[0];
}

const matrixOperations: MatrixOperation[] = [
  "send",
  "scratch",
  "copy",
  "update",
  "attach",
];

test("booking status eligibility for every quotation and proposal write", async () => {
  for (const status of [
    "under_review",
    "needs_details",
    "accepted",
    "declined",
    "cancelled",
  ]) {
    for (const operation of matrixOperations) {
      const fixture = await matrixFixture(operation);
      // Set status without changing the revision, so the status guard itself is tested.
      await pool.query(
        "UPDATE booking_requests SET status = $1 WHERE id = $2",
        [status, fixture.id],
      );
      const before = await matrixSnapshot(fixture.id);
      const response = await fixture.invoke();
      const closed = status === "declined" || status === "cancelled";
      assert.equal(
        response.status,
        closed ? 409 : 200,
        `${status} ${operation}: ${await response.clone().text()}`,
      );

      if (closed)
        assert.deepEqual(
          await matrixSnapshot(fixture.id),
          before,
          `${status} ${operation} committed effects`,
        );
      else
        assert.notDeepEqual(
          await matrixSnapshot(fixture.id),
          before,
          `${status} ${operation} did not persist`,
        );
    }
  }
});

test("booking conversations permit proposal preparation and delivery regardless of activity", async () => {
  const b = await booking(null);
  await db
    .updateTable("conversations")
    .set({ created_at: new Date("2020-01-01T00:00:00Z") })
    .where("booking_request_id", "=", b.id)
    .execute();
  const custom = await read(
    await call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
      ...proposalContent,
      expectedBookingUpdatedAt: b.updatedAt,
    }),
    200,
  );
  assert.equal(custom.package.packageType, "custom");
  const quotation = await send(b.id);
  assert.equal(quotation.status, "sent");
});

test("quotation and package prerequisites reject independently without effects", async () => {
  async function rejected(
    id: string,
    request: () => Response | Promise<Response>,
    error: string,
  ) {
    const before = await matrixSnapshot(id);
    const result = await read(await request(), 409);
    assert.equal(result.error, error);
    assert.deepEqual(await matrixSnapshot(id), before);
  }

  const archived = await db
    .insertInto("packages")
    .values({
      slug: `archived-${randomUUID()}`,
      name: "Archived synthetic package",
      max_guests: 50,
      price: 1000,
      archived_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const attach = await booking(null);
  await rejected(
    attach.id,
    () =>
      call(`/admin/booking-requests/${attach.id}/package`, "POST", {
        packageId: archived.id,
        expectedBookingUpdatedAt: attach.updatedAt,
      }),
    "Package is unavailable or changed",
  );
  const copyArchived = await booking(null);
  await rejected(
    copyArchived.id,
    () =>
      call(
        `/admin/booking-requests/${copyArchived.id}/custom-package`,
        "POST",
        {
          ...proposalContent,
          sourcePackageId: archived.id,
          expectedUpdatedAt: archived.updated_at.toISOString(),
          expectedBookingUpdatedAt: copyArchived.updatedAt,
        },
      ),
    "Archived packages cannot be customized",
  );

  const staleBooking = await booking(null);
  await pool.query(
    "UPDATE booking_requests SET updated_at = updated_at + interval '1 second' WHERE id = $1",
    [staleBooking.id],
  );
  await rejected(
    staleBooking.id,
    () =>
      call(
        `/admin/booking-requests/${staleBooking.id}/custom-package`,
        "POST",
        {
          ...proposalContent,
          expectedBookingUpdatedAt: staleBooking.updatedAt,
        },
      ),
    "Booking or package changed. Refresh and try again",
  );

  const source = await db
    .insertInto("packages")
    .values({
      slug: `source-${randomUUID()}`,
      name: "Synthetic source package",
      max_guests: 50,
      price: 1000,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const staleSource = await booking(null);
  await pool.query(
    "UPDATE packages SET updated_at = updated_at + interval '1 second' WHERE id = $1",
    [source.id],
  );
  await rejected(
    staleSource.id,
    () =>
      call(`/admin/booking-requests/${staleSource.id}/custom-package`, "POST", {
        ...proposalContent,
        sourcePackageId: source.id,
        expectedUpdatedAt: source.updated_at.toISOString(),
        expectedBookingUpdatedAt: staleSource.updatedAt,
      }),
    "Booking or package changed. Refresh and try again",
  );

  const staleCustom = await booking(null);
  const custom = await read(
    await call(
      `/admin/booking-requests/${staleCustom.id}/custom-package`,
      "POST",
      {
        ...proposalContent,
        expectedBookingUpdatedAt: staleCustom.updatedAt,
      },
    ),
    200,
  );
  await pool.query(
    "UPDATE packages SET updated_at = updated_at + interval '1 second' WHERE id = $1",
    [custom.package.id],
  );
  await rejected(
    staleCustom.id,
    () =>
      call(
        `/admin/booking-requests/${staleCustom.id}/custom-package`,
        "PATCH",
        {
          ...proposalContent,
          expectedUpdatedAt: custom.package.updatedAt,
          expectedBookingUpdatedAt: custom.bookingRequest.updatedAt,
        },
      ),
    "Booking or package changed. Refresh and try again",
  );
});

test("booking closure and writes serialize on the booking lock", async () => {
  for (const operation of matrixOperations) {
    const fixture = await matrixFixture(operation);
    const before = await matrixSnapshot(fixture.id);
    const client = await pool.connect();
    let pending: Promise<Response> | undefined;

    try {
      await client.query("BEGIN");
      const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0]
        .pid;
      // Preserve the revision to exercise the locked status recheck, including
      // custom-package writes that performed their first check before the lock.
      await client.query(
        "UPDATE booking_requests SET status = 'declined' WHERE id = $1",
        [fixture.id],
      );
      pending = Promise.resolve(fixture.invoke());
      const deadline = Date.now() + 10000;
      let blocked = false;

      while (Date.now() < deadline && !blocked) {
        const result = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked",
          [pid],
        );
        blocked = result.rows[0].blocked;

        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
      }

      assert.ok(blocked, `${operation} did not wait for the booking lock`);
      await client.query("COMMIT");
      const response = await pending;
      assert.equal(
        response.status,
        409,
        `${operation}: ${await response.clone().text()}`,
      );
      const after = await matrixSnapshot(fixture.id);
      assert.deepEqual(
        after,
        { ...before, booking: { ...before.booking, status: "declined" } },
        `${operation} committed effects after closure`,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();

      if (pending) await pending;
    }

    // The inverse ordering: the write commits while open, then closure keeps it as history.
    const earlier = await matrixFixture(operation);
    const response = await earlier.invoke();
    assert.equal(
      response.status,
      200,
      `${operation}: ${await response.clone().text()}`,
    );
    const beforeClose = await matrixSnapshot(earlier.id);
    await read(
      await call(`/admin/booking-requests/${earlier.id}/status`, "PATCH", {
        status: "declined",
        reason: "Request closed after preparation",
      }),
      200,
    );
    const afterClose = await matrixSnapshot(earlier.id);
    assert.deepEqual(afterClose.proposals, beforeClose.proposals);
    assert.deepEqual(afterClose.quotations, beforeClose.quotations);
    assert.deepEqual(afterClose.messages, beforeClose.messages);
  }
});

test("quotation and package histories paginate independently without losing current versions", async () => {
  const b = await booking();
  const current = await send(b.id);
  await pool.query(
    `INSERT INTO quotations (booking_request_id,version,currency,base_amount_minor,total_amount_minor,items,status,created_by,sent_at,offered_package_id,adjustments_reviewed)
    SELECT q.booking_request_id, n, q.currency, q.base_amount_minor, q.total_amount_minor, q.items,
      'superseded', q.created_by, now(), q.offered_package_id, true
    FROM quotations q CROSS JOIN generate_series(2, 35) n WHERE q.id = $1`,
    [current.id],
  );
  const base = `/admin/booking-requests/${b.id}/quotations?limit=10`;
  const first = await read(await call(base), 200);
  assert.equal(first.quotations.length, 10);
  assert.equal(first.currentOffer.id, current.id);
  assert.ok(first.nextCursor);
  const second = await read(
    await call(`${base}&cursor=${encodeURIComponent(first.nextCursor)}`),
    200,
  );
  assert.equal(second.quotations[0].version, 25);
  assert.equal(second.currentOffer.id, current.id);
  const removedId = first.quotations.at(-1).id;
  await pool.query("DELETE FROM quotations WHERE id = $1", [removedId]);
  const repeated = await read(
    await call(`${base}&cursor=${encodeURIComponent(first.nextCursor)}`),
    200,
  );
  assert.deepEqual(
    repeated.quotations.map((q: any) => q.id),
    second.quotations.map((q: any) => q.id),
  );
  const exact = await read(
    await call(
      `/admin/booking-requests/${b.id}/quotations?quotationId=${current.id}`,
    ),
    200,
  );
  assert.deepEqual(
    exact.quotations.map((q: any) => q.id),
    [current.id],
  );
  const customer = await read(
    await call(
      `/booking-requests/${b.id}/quotations?limit=10`,
      "GET",
      undefined,
      customerCookie,
    ),
    200,
  );
  assert.ok(customer.quotations.every((q: any) => q.status !== "draft"));
  assert.equal(customer.currentOffer.id, current.id);
  await read(
    await call(
      `/booking-requests/${b.id}/quotations?cursor=${encodeURIComponent(first.nextCursor)}`,
      "GET",
      undefined,
      customerCookie,
    ),
    400,
  );
  await read(
    await call(
      `/booking-requests/${b.id}/quotations`,
      "GET",
      undefined,
      otherCookie,
    ),
    404,
  );
  const another = await booking();
  await read(
    await call(
      `/admin/booking-requests/${another.id}/quotations?cursor=${encodeURIComponent(first.nextCursor)}`,
    ),
    400,
  );

  const pkg = (
    await read(await call(`/admin/booking-requests/${b.id}/package`), 200)
  ).package;
  await pool.query(
    `INSERT INTO audit_events(action, entity_type, entity_id, metadata, created_at)
    SELECT 'booking.custom_package_updated', 'booking_request', $1, $2::jsonb,
      '2098-01-01T00:00:00.123000Z'::timestamptz + (n / 2) * interval '1 microsecond'
    FROM generate_series(1, 34) n`,
    [b.id, JSON.stringify({ before: pkg, after: pkg })],
  );
  const invalidPosition = Buffer.from(
    JSON.stringify({
      version: 1,
      scope: JSON.stringify(["private-package-history", b.id]),
      position: { createdAt: "2026-99-99T00:00:00.000001Z", id: randomUUID() },
    }),
  ).toString("base64url");
  await read(
    await call(
      `/admin/booking-requests/${b.id}/package-history?cursor=${invalidPosition}`,
    ),
    400,
  );
  const historyBase = `/admin/booking-requests/${b.id}/package-history?limit=10`;
  const historyFirst = await read(await call(historyBase), 200);
  const historySecond = await read(
    await call(
      `${historyBase}&cursor=${encodeURIComponent(historyFirst.nextCursor)}`,
    ),
    200,
  );
  assert.equal(historyFirst.history.length, 10);
  assert.equal(historySecond.history.length, 10);
  assert.equal(
    new Set(
      [...historyFirst.history, ...historySecond.history].map(
        (row: any) => row.id,
      ),
    ).size,
    20,
  );
  await pool.query("DELETE FROM audit_events WHERE id = $1", [
    historyFirst.history.at(-1).id,
  ]);
  const afterDeletion = await read(
    await call(
      `${historyBase}&cursor=${encodeURIComponent(historyFirst.nextCursor)}`,
    ),
    200,
  );
  assert.deepEqual(
    afterDeletion.history.map((row: any) => row.id),
    historySecond.history.map((row: any) => row.id),
  );
  await read(
    await call(
      `/admin/booking-requests/${another.id}/package-history?cursor=${encodeURIComponent(historyFirst.nextCursor)}`,
    ),
    400,
  );
  await read(await call(historyBase, "GET", undefined, customerCookie), 403);
});

test("package-less inquiries require a proposal and support private custom packages", async () => {
  const b = await booking(null);
  assert.equal(b.packageId, null);
  await read(await call(`${quotationPath(b.id)}/prepare`), 409);
  assert.deepEqual(
    (await read(await call(`/admin/booking-requests/${b.id}/quotations`), 200))
      .quotations,
    [],
  );
  const result = await read(
    await call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
      name: "Private proposal",
      description: "Custom",
      maxGuests: 50,
      price: { kind: "fixed", currency: "PHP", amountMinor: 100000 },
      sections: [],
      expectedBookingUpdatedAt: b.updatedAt,
    }),
    200,
  );
  assert.equal(result.bookingRequest.packageId, null);
  assert.equal(result.package.packageType, "custom");
  assert.equal(
    (
      await call(
        `/packages/${result.package.id}`,
        "GET",
        undefined,
        customerCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/booking-requests/${b.id}/package`,
        "GET",
        undefined,
        otherCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(`/admin/booking-requests/${b.id}/package`, "POST", {
        packageId,
        expectedBookingUpdatedAt: result.bookingRequest.updatedAt,
      })
    ).status,
    409,
  );
  const history = await read(
    await call(`/admin/booking-requests/${b.id}/package-history`),
    200,
  );
  assert.equal(history.history[0].before, null);
  const prepared = await prepare(result.bookingRequest.id);
  assert.equal(prepared.packageId, result.package.id);
});

test("catalog attachment and scratch proposal serialize on the same inquiry", async () => {
  const b = await booking(null);
  const [catalog, custom] = await Promise.all([
    call(`/admin/booking-requests/${b.id}/package`, "POST", {
      packageId,
      expectedBookingUpdatedAt: b.updatedAt,
    }),
    call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
      name: "Concurrent proposal",
      maxGuests: 50,
      price: { kind: "fixed", currency: "PHP", amountMinor: 100000 },
      sections: [],
      expectedBookingUpdatedAt: b.updatedAt,
    }),
  ]);
  assert.deepEqual([catalog.status, custom.status].sort(), [200, 409]);
  const row = await db
    .selectFrom("booking_requests")
    .select("package_id")
    .where("id", "=", b.id)
    .executeTakeFirstOrThrow();
  const privatePackages = await db
    .selectFrom("packages")
    .select("id")
    .where("custom_for_booking_request_id", "=", b.id)
    .execute();
  assert.equal(row.package_id === packageId, catalog.status === 200);
  assert.equal(privatePackages.length, custom.status === 200 ? 1 : 0);
  const current = await read(
    await call(`/admin/booking-requests/${b.id}/package`),
    200,
  );
  assert.equal(
    current.package.id,
    catalog.status === 200 ? packageId : privatePackages[0].id,
  );
});

function includedService(serviceId: string): CatalogSection[] {
  return [
    {
      id: randomUUID(),
      title: "Included services",
      widgets: [
        {
          id: randomUUID(),
          type: "service",
          serviceId,
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          markdown: "",
          media: null,
          alt: "",
          caption: "",
          autoplay: false,
          serviceTerms: { includedHours: 2, hourlyRatePesos: 750 },
        },
      ],
    },
  ];
}

async function quotationAddonsFixture() {
  const b = await booking(null);
  const suffix = randomUUID().slice(0, 8);

  const [fixed, hourly, included] = await db
    .insertInto("services")
    .values(
      ["Photo booth", "Extra lighting", "On-site support"].map((name) => ({
        name: `${name} ${suffix}`,
        slug: `quote-addon-${randomUUID()}`,
        description: "Quotation add-on fixture",
        fixed_price_pesos: 9000,
        hourly_rate_pesos: 1500,
        included_hours: 6,
      })),
    )
    .returning(["id", "name"])
    .execute();

  const addonServices: PackageAddonService[] = [
    {
      id: randomUUID(),
      serviceId: fixed.id,
      fixedPricePesos: 1500,
      hourlyRatePesos: 300,
      includedHours: 3,
    },
    {
      id: randomUUID(),
      serviceId: hourly.id,
      fixedPricePesos: null,
      hourlyRatePesos: 650,
      includedHours: null,
    },
  ];
  const content = {
    ...proposalContent,
    addonServices,
    sections: includedService(included.id),
  };
  const endpoint = `/admin/booking-requests/${b.id}/custom-package`;
  const proposal = await read(
    await call(endpoint, "POST", {
      ...content,
      expectedBookingUpdatedAt: b.updatedAt,
    }),
    200,
  );

  return {
    b,
    proposal,
    content,
    included,
    serviceNames: [fixed.name, hourly.name],
    update: (changes: Partial<typeof content>) =>
      call(endpoint, "PATCH", {
        ...content,
        ...changes,
        expectedUpdatedAt: proposal.package.updatedAt,
        expectedBookingUpdatedAt: proposal.bookingRequest.updatedAt,
      }),
  };
}

test("preparation is admin-only, repeatable, and creates no records", async () => {
  const b = await booking();
  const path = quotationPath(b.id);
  const before = await matrixSnapshot(b.id);

  await read(await call(`${path}/prepare`, "GET", undefined, ""), 401);
  await read(
    await call(`${path}/prepare`, "GET", undefined, customerCookie),
    403,
  );
  const prepared = await prepare(b.id);
  assert.deepEqual(prepared, {
    bookingRequestId: b.id,
    expectedBookingUpdatedAt: b.updatedAt,
    packageId,
    expectedPackageUpdatedAt: new Date(
      before.catalog.find((pkg: { id: string }) => pkg.id === packageId)
        .updated_at,
    ).toISOString(),
    currentOffer: null,
    baseAmountMinor: 100000,
    items: [],
  });
  assert.deepEqual(await prepare(b.id), prepared);
  await read(await sendRequest(b.id, sendInput(prepared), customerCookie), 403);

  // Retired routes cannot create, save, revise or deliver a persisted draft.
  const quoteId = randomUUID();
  assert.equal(
    (await call(path, "POST", { expectedUpdatedAt: b.updatedAt })).status,
    404,
  );

  for (const [suffix, method] of [
    ["", "PATCH"],
    ["/revision", "POST"],
    ["/send", "POST"],
  ]) {
    assert.equal(
      (await call(`/admin/quotations/${quoteId}${suffix}`, method, {})).status,
      404,
    );
  }

  assert.deepEqual(await matrixSnapshot(b.id), before);
});

test("a send commits one offer, exact conversation message and audit across concurrent retries", async () => {
  const b = await booking();
  const input = sendInput(await prepare(b.id));
  const [first, retry] = await Promise.all([
    sendRequest(b.id, input),
    sendRequest(b.id, input),
  ]);
  const { quotation } = await read(first, 200);
  assert.deepEqual(await read(retry, 200), { quotation });
  assert.equal(quotation.id, input.requestId);
  assert.equal(quotation.version, 1);
  assert.equal(quotation.status, "sent");
  assert.equal(quotation.previousQuotationId, null);
  assert.equal(quotation.createdBy, adminId);

  const after = await matrixSnapshot(b.id);
  assert.equal(after.quotations.length, 1);
  assert.equal(after.messages.length, 1);
  assert.equal(after.messages[0].quotation_id, quotation.id);
  assert.equal(after.messages[0].sender_id, adminId);
  assert.equal(after.messages[0].conversation_id, after.conversations[0].id);
  assert.equal(after.conversations[0].ai_enabled, false);

  const events = after.audits.filter(
    (row: { entity_id: string }) => row.entity_id === quotation.id,
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].action, "quotation.sent");
  assert.equal(events[0].actor_id, adminId);
  assert.equal(after.booking.status, "under_review");

  await read(
    await sendRequest(b.id, { ...input, items: [manual("add", 1000)] }),
    409,
  );
  await read(await sendRequest(b.id, input, secondAdminCookie), 409);
  assert.deepEqual(await matrixSnapshot(b.id), after);

  // The customer can read the exact delivered offer and sends feedback in chat.
  const quotePath = `/quotations/${quotation.id}`;
  assert.deepEqual(
    await read(await call(quotePath, "GET", undefined, customerCookie), 200),
    { quotation },
  );
  await read(await call(quotePath, "GET", undefined, otherCookie), 404);

  for (const action of ["accept", "revision"]) {
    assert.equal(
      (await call(`${quotePath}/${action}`, "POST", {}, customerCookie)).status,
      404,
    );
  }

  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      {
        body: "Please change the offer.",
        conversationId: after.conversations[0].id,
      },
      customerCookie,
    ),
    201,
  );
  const feedback = await matrixSnapshot(b.id);
  assert.deepEqual(feedback.quotations, after.quotations);
  assert.equal(feedback.messages.length, 2);
  assert.deepEqual(feedback.audits, after.audits);
});

test("only one of two competing revisions sends and supersedes the current offer", async () => {
  const b = await booking();
  const first = await send(b.id);
  const before = await matrixSnapshot(b.id);
  const prepared = await prepare(b.id);
  assert.equal(prepared.currentOffer?.id, first.id);
  assert.deepEqual(await matrixSnapshot(b.id), before);
  await read(await sendRequest(b.id, sendInput(prepared, [], null)), 400);
  assert.deepEqual(await matrixSnapshot(b.id), before);

  const left = sendInput(
    prepared,
    [manual("deduct", 1500)],
    "Early booking discount",
  );
  const right = sendInput(prepared, [manual("add", 5000)], "Delivery fee");
  const responses = await Promise.all([
    sendRequest(b.id, left, secondAdminCookie),
    sendRequest(b.id, right),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );

  const winner = responses.find((response) => response.status === 200);

  assert.ok(winner);
  const { quotation } = await read(winner, 200);
  assert.equal(quotation.version, 2);
  assert.equal(quotation.previousQuotationId, first.id);
  const successfulInput = quotation.id === left.requestId ? left : right;
  assert.equal(quotation.revisionReason, successfulInput.revisionReason);
  const snapshot = await matrixSnapshot(b.id);
  assert.equal(snapshot.messages.length, 2);
  assert.equal(snapshot.quotations.length, 2);
  assert.equal(
    snapshot.quotations.find((row: Quotation) => row.id === first.id).status,
    "superseded",
  );
  assert.equal(
    snapshot.quotations.find((row: Quotation) => row.id === quotation.id)
      .status,
    "sent",
  );
  assert.equal(
    snapshot.messages.find(
      (row: { quotation_id: string }) => row.quotation_id === quotation.id,
    ).sender_id,
    quotation.createdBy,
  );
  const customerHistory = await read(
    await call(
      `/booking-requests/${b.id}/quotations`,
      "GET",
      undefined,
      customerCookie,
    ),
    200,
  );
  assert.equal(customerHistory.currentOffer.id, quotation.id);
  assert.deepEqual(
    customerHistory.quotations.map((q: Quotation) => [q.id, q.status]),
    [
      [quotation.id, "sent"],
      [first.id, "superseded"],
    ],
  );
});

function manual(direction: "add" | "deduct", amountMinor: number) {
  return {
    id: randomUUID(),
    direction,
    kind: direction === "add" ? ("addition" as const) : ("deduction" as const),
    description: direction === "add" ? "Transport fee" : "Event discount",
    amountMinor,
    serviceId: null,
  };
}

test("send rejects stale booking, package and offer revisions without partial writes", async () => {
  const b = await booking();
  const prepared = await prepare(b.id);
  const input = sendInput(prepared);
  let before = await matrixSnapshot(b.id);

  for (const invalid of [
    { ...input, expectedBookingUpdatedAt: "1900-01-01T00:00:00Z" },
    { ...input, expectedPackageUpdatedAt: "1900-01-01T00:00:00Z" },
    { ...input, packageId: randomUUID() },
    {
      ...input,
      currentOffer: {
        id: randomUUID(),
        updatedAt: prepared.expectedBookingUpdatedAt,
      },
    },
  ]) {
    await read(await sendRequest(b.id, invalid), 409);
  }

  await read(
    await sendRequest(b.id, { ...input, revisionReason: "No prior offer" }),
    400,
  );
  assert.deepEqual(await matrixSnapshot(b.id), before);

  const first = await send(b.id, input);
  const replacement = sendInput(await prepare(b.id));
  before = await matrixSnapshot(b.id);
  await read(
    await sendRequest(b.id, {
      ...replacement,
      currentOffer: { id: first.id, updatedAt: "1900-01-01T00:00:00Z" },
    }),
    409,
  );
  assert.deepEqual(await matrixSnapshot(b.id), before);

  const other = await booking();
  await read(
    await sendRequest(other.id, {
      ...sendInput(await prepare(other.id)),
      requestId: input.requestId,
    }),
    409,
  );
  assert.equal((await matrixSnapshot(other.id)).quotations.length, 0);
});

test("manual fees and discounts retain the bounds and cannot carry service references", async () => {
  const b = await booking();
  const prepared = await prepare(b.id);
  const fee = manual("add", 3000);
  const discount = manual("deduct", 500);
  const before = await matrixSnapshot(b.id);

  for (const items of [
    [{ ...fee, serviceId: randomUUID() }],
    [{ ...fee, amountMinor: 1.5 }],
    [{ ...fee, description: " " }],
    [fee, { ...discount, id: fee.id.toUpperCase() }],
    Array.from({ length: MAX_QUOTATION_ITEMS + 1 }, () => manual("add", 100)),
    [manual("deduct", 100001)],
    [manual("add", MAX_QUOTATION_AMOUNT_MINOR)],
  ]) {
    await read(await sendRequest(b.id, { ...sendInput(prepared), items }), 400);
  }

  assert.deepEqual(await matrixSnapshot(b.id), before);
  const q = await send(b.id, sendInput(prepared, [fee, discount]));
  assert.deepEqual(q.items, [fee, discount]);
  assert.equal(q.totalAmountMinor, 102500);
  assert.deepEqual((await prepare(b.id)).items, [fee, discount]);
});

test("a legacy saved draft stays intact and the last delivered offer stays current", async () => {
  const b = await booking();
  const first = await send(
    b.id,
    sendInput(await prepare(b.id), [manual("add", 900)]),
  );
  await pool.query(
    "UPDATE quotations SET status = 'superseded', superseded_at = now() WHERE id = $1",
    [first.id],
  );
  const legacy = (
    await pool.query(
      `INSERT INTO quotations (booking_request_id, version, currency, base_amount_minor, total_amount_minor,
       status, created_by, offered_package_id, adjustments_reviewed, previous_quotation_id, revision_reason)
     VALUES ($1, 2, 'PHP', 99000, 99000, 'draft', $2, $3, false, $4, 'Abandoned preparation')
     RETURNING id`,
      [b.id, adminId, packageId, first.id],
    )
  ).rows[0].id;
  const before = await matrixSnapshot(b.id);

  for (const [path, cookie] of [
    [quotationPath(b.id), adminCookie],
    [`/booking-requests/${b.id}/quotations`, customerCookie],
  ]) {
    const history = await read(await call(path, "GET", undefined, cookie), 200);
    assert.equal(history.currentOffer.id, first.id);
    assert.deepEqual(
      history.quotations.map((q: Quotation) => q.id),
      [first.id],
    );
    assert.equal("currentDraft" in history, false);
  }

  await read(
    await call(`/quotations/${legacy}`, "GET", undefined, customerCookie),
    404,
  );
  const prepared = await prepare(b.id);
  assert.equal(prepared.currentOffer?.id, first.id);
  assert.deepEqual(prepared.items, first.items);
  assert.deepEqual(await matrixSnapshot(b.id), before);
  const replacement = await send(
    b.id,
    sendInput(prepared, [], "Replace delivered offer"),
  );
  assert.equal(replacement.version, 3);
  assert.equal(replacement.previousQuotationId, first.id);
  const after = await matrixSnapshot(b.id);
  assert.deepEqual(
    after.quotations.find((row: Quotation) => row.id === legacy),
    before.quotations.find((row: Quotation) => row.id === legacy),
  );
});

test("missing conversation and a message insertion failure roll back the entire send", async () => {
  const without = await booking();
  await db
    .deleteFrom("conversations")
    .where("booking_request_id", "=", without.id)
    .execute();
  const absent = await matrixSnapshot(without.id);
  await read(
    await sendRequest(without.id, sendInput(await prepare(without.id))),
    409,
  );
  assert.deepEqual(await matrixSnapshot(without.id), absent);

  const b = await booking();
  const first = await send(b.id);
  const replacement = sendInput(await prepare(b.id));
  const pending = {
    reason: "needs_admin_review",
    summary: "The customer needs a quotation.",
    pending: true,
  };
  await db
    .updateTable("conversations")
    .set({ ai_handoff: pending, ai_enabled: false, ai_version: 1 })
    .where("booking_request_id", "=", b.id)
    .execute();
  const before = await matrixSnapshot(b.id);
  await pool.query(
    "CREATE FUNCTION reject_quote_message_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.quotation_id IS NOT NULL THEN RAISE EXCEPTION 'fixture delivery failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_quote_message_test BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION reject_quote_message_test()",
  );

  try {
    assert.equal((await sendRequest(b.id, replacement)).status, 500);
    assert.deepEqual(await matrixSnapshot(b.id), before);
    assert.equal((await prepare(b.id)).currentOffer?.id, first.id);
  } finally {
    await pool.query("DROP TRIGGER reject_quote_message_test ON messages");
    await pool.query("DROP FUNCTION reject_quote_message_test()");
  }

  const sent = await send(b.id, replacement);
  assert.equal(sent.previousQuotationId, first.id);
  const current = await matrixSnapshot(b.id);
  assert.deepEqual(current.conversations[0].ai_handoff, {
    ...pending,
    pending: false,
  });
  assert.equal(current.conversations[0].ai_version, 2);
  assert.equal(current.messages.length, 2);
});

test("prepared add-ons are mandatory and delivery derives every immutable term from the package", async () => {
  const { b, content, included, serviceNames } = await quotationAddonsFixture();
  const before = await matrixSnapshot(b.id);
  const prepared = await prepare(b.id);
  assert.deepEqual(await matrixSnapshot(b.id), before);
  assert.deepEqual(
    prepared.items.map((item) => item.serviceId),
    content.addonServices.map((addon) => addon.serviceId),
  );
  const [fixed, hourly] = prepared.items as [
    QuotationAddonItem,
    QuotationAddonItem,
  ];
  assert.deepEqual([fixed.description, hourly.description], serviceNames);
  assert.equal(fixed.amountMinor, 150000);
  assert.equal(fixed.addon.hours, 0);
  assert.equal(hourly.addon.hours, null);
  assert.equal(hourly.amountMinor, null);
  const fixedCharge = { id: fixed.id, addon: { hours: 2 } };
  const hourlyCharge = { id: hourly.id, addon: { hours: 3 } };

  for (const items of [
    [],
    [fixedCharge],
    [fixedCharge, { ...hourlyCharge, id: randomUUID() }],
    [fixedCharge, hourlyCharge, { id: included.id, addon: { hours: 1 } }],
    [fixedCharge, manual("add", 130000)],
  ]) {
    await read(await sendRequest(b.id, sendInput(prepared, items)), 409);
  }

  for (const items of [
    [fixedCharge, { ...hourlyCharge, addon: { hours: 0 } }],
    [
      fixedCharge,
      { ...hourlyCharge, addon: { hours: MAX_QUOTATION_AMOUNT_MINOR } },
    ],
    [fixedCharge, { ...hourlyCharge, addon: { hours: null } }],
    [
      fixedCharge,
      { ...hourlyCharge, addon: { hours: 2, hourlyRateOverrideMinor: 1 } },
    ],
    [
      fixedCharge,
      { ...hourlyCharge, addon: { hours: 2, source: hourly.addon.source } },
    ],
    [
      fixedCharge,
      hourlyCharge,
      { ...hourlyCharge, id: hourly.id.toUpperCase() },
    ],
    [
      fixedCharge,
      hourlyCharge,
      { ...manual("add", 4500), serviceId: included.id },
    ],
  ]) {
    await read(await sendRequest(b.id, { ...sendInput(prepared), items }), 400);
  }

  assert.deepEqual(await matrixSnapshot(b.id), before);

  const fee = manual("add", 2500);
  const sent = await send(
    b.id,
    sendInput(prepared, [fixedCharge, hourlyCharge, fee]),
  );
  assert.deepEqual(
    sent.items.map((item) => item.amountMinor),
    [210000, 195000, 2500],
  );
  assert.deepEqual(
    sent.items.flatMap((item) => (item.addon ? [item.addon.source] : [])),
    [fixed.addon.source, hourly.addon.source],
  );
  assert.equal(sent.totalAmountMinor, 507500);
  const visible = (
    await read(
      await call(`/quotations/${sent.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).quotation;
  assert.deepEqual(
    visible.items.map((item: QuotationAddonItem) => item.amountMinor),
    [210000, 195000, 2500],
  );
  assert.ok(visible.items.every((item: QuotationAddonItem) => !item.addon));
  assert.match(visible.items[0].description, /3 included hours/);
  assert.match(visible.items[0].description, /2 extra hours/);
  const revision = await prepare(b.id);
  assert.deepEqual(
    revision.items.map((item) => item.addon?.hours),
    [2, 3, undefined],
  );
});

test("package add-on edits and deletion are isolated and version the owning proposal", async () => {
  const { b, proposal, content } = await quotationAddonsFixture();
  const [fixed, hourly] = content.addonServices;
  const path = `/admin/booking-requests/${b.id}/custom-package/addons`;
  const prepared = await prepare(b.id);
  const sent = await send(
    b.id,
    sendInput(prepared, [
      { id: fixed.id, addon: { hours: 2 } },
      { id: hourly.id, addon: { hours: 3 } },
    ]),
  );
  const pending = await prepare(b.id);
  const privateBefore = await matrixSnapshot(b.id);
  const servicesBefore = (
    await pool.query("SELECT * FROM services ORDER BY id")
  ).rows;
  const source = {
    packageId: proposal.package.id,
    expectedBookingUpdatedAt: proposal.bookingRequest.updatedAt,
    expectedUpdatedAt: proposal.package.updatedAt,
  };
  const pricing = {
    fixedPricePesos: 2000,
    includedHours: 4,
    hourlyRatePesos: 400,
  };

  await read(
    await call(
      `${path}/${fixed.id}`,
      "PATCH",
      { ...source, ...pricing },
      customerCookie,
    ),
    403,
  );
  await read(
    await call(`${path}/${fixed.id}`, "PATCH", {
      ...source,
      ...pricing,
      serviceId: hourly.serviceId,
    }),
    400,
  );
  await read(
    await call(`${path}/${fixed.id}`, "PATCH", {
      ...source,
      ...pricing,
      includedHours: null,
    }),
    400,
  );
  await read(
    await call(`${path}/${fixed.id}`, "DELETE", { ...source, packageId }),
    409,
  );
  await read(await call(`${path}/${randomUUID()}`, "DELETE", source), 404);
  assert.deepEqual(await matrixSnapshot(b.id), privateBefore);

  const updated = await read(
    await call(`${path}/${fixed.id}`, "PATCH", { ...source, ...pricing }),
    200,
  );
  const current = await matrixSnapshot(b.id);
  const nextAddon = { ...fixed, ...pricing };
  assert.deepEqual(current.proposals, [
    {
      ...privateBefore.proposals[0],
      updated_at: current.proposals[0].updated_at,
      addon_services: [nextAddon, hourly],
    },
  ]);
  assert.notEqual(
    current.proposals[0].updated_at,
    privateBefore.proposals[0].updated_at,
  );
  assert.notEqual(
    updated.bookingRequest.updatedAt,
    source.expectedBookingUpdatedAt,
  );
  assert.deepEqual(current.catalog, privateBefore.catalog);
  assert.deepEqual(current.messages, privateBefore.messages);
  assert.deepEqual(current.quotations, privateBefore.quotations);
  assert.deepEqual(
    (await pool.query("SELECT * FROM services ORDER BY id")).rows,
    servicesBefore,
  );
  assert.equal(updated.package.addonServices[0].service.id, fixed.serviceId);
  assert.equal(
    updated.package.price.amountMinor,
    proposal.package.price.amountMinor,
  );
  const history = await read(
    await call(`/admin/booking-requests/${b.id}/package-history`),
    200,
  );
  assert.equal(history.history[0].after.addonServices[0].fixedPricePesos, 2000);
  assert.equal(
    history.history[0].before.addonServices[0].fixedPricePesos,
    1500,
  );

  await read(await call(`${path}/${hourly.id}`, "DELETE", source), 409);
  await read(
    await sendRequest(
      b.id,
      sendInput(pending, [
        { id: fixed.id, addon: { hours: 2 } },
        { id: hourly.id, addon: { hours: 3 } },
      ]),
    ),
    409,
  );
  const revised = await prepare(b.id);
  assert.deepEqual(revised.currentOffer, pending.currentOffer);
  assert.equal(revised.items[0].amountMinor, 280000);
  assert.equal(revised.items[0].addon?.source.includedHours, 4);

  const deleted = await read(
    await call(`${path}/${hourly.id}`, "DELETE", {
      packageId: updated.package.id,
      expectedBookingUpdatedAt: updated.bookingRequest.updatedAt,
      expectedUpdatedAt: updated.package.updatedAt,
    }),
    200,
  );
  assert.deepEqual(
    deleted.package.addonServices.map((addon: PackageAddonService) => addon.id),
    [fixed.id],
  );
  const afterDelete = await matrixSnapshot(b.id);
  assert.deepEqual(afterDelete.proposals, [
    {
      ...current.proposals[0],
      updated_at: afterDelete.proposals[0].updated_at,
      addon_services: [nextAddon],
    },
  ]);
  assert.deepEqual(afterDelete.quotations, current.quotations);
  const finalPreparation = await prepare(b.id);
  const replacement = await send(
    b.id,
    sendInput(finalPreparation, [{ id: fixed.id, addon: { hours: 2 } }]),
  );
  assert.equal(replacement.totalAmountMinor, 380000);
  const historical = (
    await read(
      await call(`/quotations/${sent.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).quotation;
  assert.equal(historical.totalAmountMinor, sent.totalAmountMinor);
  assert.equal(historical.items.length, 2);
});

test("archiving an add-on blocks delivery until an admin deletes it from the package", async () => {
  const { b, proposal, content } = await quotationAddonsFixture();
  const [fixed, hourly] = content.addonServices;
  const prepared = await prepare(b.id);
  await db
    .updateTable("services")
    .set({ archived_at: new Date() })
    .where("id", "=", hourly.serviceId)
    .execute();
  const before = await matrixSnapshot(b.id);
  await read(
    await sendRequest(
      b.id,
      sendInput(prepared, [
        { id: fixed.id, addon: { hours: 0 } },
        { id: hourly.id, addon: { hours: 1 } },
      ]),
    ),
    409,
  );
  assert.equal(
    (await prepare(b.id)).items[1].addon?.requiresRemoval,
    "archived",
  );
  assert.deepEqual(await matrixSnapshot(b.id), before);
  await read(
    await call(
      `/admin/booking-requests/${b.id}/custom-package/addons/${hourly.id}`,
      "DELETE",
      {
        packageId: proposal.package.id,
        expectedBookingUpdatedAt: proposal.bookingRequest.updatedAt,
        expectedUpdatedAt: proposal.package.updatedAt,
      },
    ),
    200,
  );
  const fresh = await prepare(b.id);
  assert.deepEqual(
    fresh.items.map((item) => item.id),
    [fixed.id],
  );
  const sent = await send(
    b.id,
    sendInput(fresh, [{ id: fixed.id, addon: { hours: 0 } }]),
  );
  assert.equal(sent.totalAmountMinor, 250000);
});

test("revision rates and base price follow saved package changes while delivered terms stay stable", async () => {
  const { b, content, update, proposal } = await quotationAddonsFixture();
  const [fixed, hourly] = content.addonServices;
  const items = [
    { id: fixed.id, addon: { hours: 2 } },
    { id: hourly.id, addon: { hours: 3 } },
  ];
  const first = await send(b.id, sendInput(await prepare(b.id), items));
  const customerPath = `/quotations/${first.id}`;
  const firstVisible = (
    await read(await call(customerPath, "GET", undefined, customerCookie), 200)
  ).quotation;
  const stale = sendInput(await prepare(b.id), items);
  const edited = await read(
    await update({
      price: { ...content.price, amountMinor: 180000 },
      addonServices: [{ ...fixed, hourlyRatePesos: 500 }, hourly],
    }),
    200,
  );
  assert.equal(edited.package.id, proposal.package.id);
  assert.equal(edited.package.price.amountMinor, 180000);
  await db
    .updateTable("services")
    .set({ name: "Renamed service" })
    .where("id", "=", fixed.serviceId)
    .execute();
  await db
    .updateTable("booking_requests")
    .set({ time_zone: "Asia/Singapore" })
    .where("id", "=", b.id)
    .execute();
  const before = await matrixSnapshot(b.id);
  await read(await sendRequest(b.id, stale), 409);
  assert.deepEqual(await matrixSnapshot(b.id), before);

  const fresh = await prepare(b.id);
  assert.equal(fresh.baseAmountMinor, 180000);
  assert.equal(fresh.items[0].description, "Renamed service");
  assert.equal(fresh.items[0].amountMinor, 250000);
  assert.equal(fresh.currentOffer?.id, first.id);
  const next = await send(b.id, sendInput(fresh, items));
  assert.equal(next.totalAmountMinor, 625000);
  const old = (
    await read(await call(customerPath, "GET", undefined, customerCookie), 200)
  ).quotation;
  assert.equal(old.totalAmountMinor, firstVisible.totalAmountMinor);
  assert.deepEqual(old.items, firstVisible.items);
});

test("delivery permits a full-sized adjustment payload above the ordinary booking limit", async () => {
  const b = await booking();

  const items = Array.from({ length: MAX_QUOTATION_ITEMS }, () => ({
    ...manual("add", 1),
    description: "a".repeat(MAX_QUOTATION_DESCRIPTION_LENGTH),
  }));

  const q = await send(b.id, sendInput(await prepare(b.id), items));
  assert.equal(q.items.length, MAX_QUOTATION_ITEMS);
  assert.equal(q.totalAmountMinor, 100000 + MAX_QUOTATION_ITEMS);
});

test("the Edge dispatcher loads protected quotation routes and delivers through the same service", async () => {
  const { app: edge } = await import("../src/edge/server.js");
  const b = await booking();
  const path = `/v1${quotationPath(b.id)}`;
  await read(await edge.request(`${path}/prepare`), 401);
  const { preparation } = await read(
    await edge.request(`${path}/prepare`, { headers: { Cookie: adminCookie } }),
    200,
  );
  const input = sendInput(preparation, [manual("add", 500)]);
  const { quotation } = await read(
    await edge.request(`${path}/send`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    200,
  );
  assert.equal(quotation.totalAmountMinor, 100500);
  const { messages, quotations } = await matrixSnapshot(b.id);
  assert.equal(quotations.length, 1);
  assert.equal(messages[0].quotation_id, quotation.id);
});

test("closed inquiries and other private packages cannot be changed through an add-on action", async () => {
  const first = await quotationAddonsFixture();
  const second = await quotationAddonsFixture();
  const addonId = first.content.addonServices[0].id;
  const firstSource = {
    packageId: first.proposal.package.id,
    expectedBookingUpdatedAt: first.proposal.bookingRequest.updatedAt,
    expectedUpdatedAt: first.proposal.package.updatedAt,
  };
  const firstPath = `/admin/booking-requests/${first.b.id}/custom-package/addons/${addonId}`;
  const secondPath = `/admin/booking-requests/${second.b.id}/custom-package/addons/${addonId}`;
  await read(
    await call(secondPath, "DELETE", {
      ...firstSource,
      expectedBookingUpdatedAt: second.proposal.bookingRequest.updatedAt,
    }),
    409,
  );

  const pricing = {
    hourlyRatePesos: 230,
    fixedPricePesos: null,
    includedHours: null,
  };

  for (const status of ["declined", "cancelled"]) {
    // Keep the revision constant so the locked booking status is decisive.
    await pool.query("UPDATE booking_requests SET status = $1 WHERE id = $2", [
      status,
      first.b.id,
    ]);
    const before = await matrixSnapshot(first.b.id);
    await read(
      await call(firstPath, "PATCH", { ...firstSource, ...pricing }),
      409,
    );
    await read(await call(firstPath, "DELETE", firstSource), 409);
    assert.deepEqual(await matrixSnapshot(first.b.id), before);
  }
});
