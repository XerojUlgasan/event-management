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

const proposalContent = {
  name: "Status matrix proposal",
  description: "Synthetic proposal without media",
  maxGuests: 50,
  price: { kind: "fixed", currency: "PHP", amountMinor: 100000 },
  sections: [],
};

type MatrixOperation =
  | "create"
  | "revise"
  | "save"
  | "send"
  | "scratch"
  | "copy"
  | "update"
  | "attach";

// Every operation gets its own booking and satisfies all non-status prerequisites.
async function matrixFixture(operation: MatrixOperation) {
  const b = await booking(
    ["scratch", "update", "attach"].includes(operation) ? null : packageId,
  );
  let q: any;
  let custom: any;

  if (["revise", "save", "send"].includes(operation)) q = await create(b);

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
      case "create":
        return call(`/admin/booking-requests/${b.id}/quotations`, "POST", {
          expectedUpdatedAt: currentBooking.updatedAt,
        });
      case "revise":
        return call(`/admin/quotations/${q.id}/revision`, "POST", {
          expectedUpdatedAt: q.updatedAt,
          reason: "Review proposal",
        });
      case "save":
        return call(`/admin/quotations/${q.id}`, "PATCH", {
          expectedUpdatedAt: q.updatedAt,
          items: [],
        });
      case "send":
        return call(`/admin/quotations/${q.id}/send`, "POST", {
          expectedUpdatedAt: q.updatedAt,
        });
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
  "create",
  "revise",
  "save",
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
        closed ? 409 : ["create", "revise"].includes(operation) ? 201 : 200,
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

test("closed conversations permit proposal and draft preparation but block delivery", async () => {
  const b = await booking(null);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("booking_request_id", "=", b.id)
    .execute();
  const custom = await read(
    await call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
      ...proposalContent,
      expectedBookingUpdatedAt: b.updatedAt,
    }),
    200,
  );
  const q = await create(custom.bookingRequest);
  const before = await matrixSnapshot(b.id);
  const response = await call(`/admin/quotations/${q.id}/send`, "POST", {
    expectedUpdatedAt: q.updatedAt,
  });
  assert.equal(response.status, 409, await response.clone().text());
  assert.deepEqual(await matrixSnapshot(b.id), before);
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

  const duplicate = await booking();
  await create(duplicate);
  const fresh = (
    await read(await call(`/admin/booking-requests/${duplicate.id}`), 200)
  ).bookingRequest;
  await rejected(
    duplicate.id,
    () =>
      call(`/admin/booking-requests/${duplicate.id}/quotations`, "POST", {
        expectedUpdatedAt: fresh.updatedAt,
      }),
    "Revise the active quotation instead",
  );

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
      ["create", "revise"].includes(operation) ? 201 : 200,
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

test("quotation delivery, ownership, removed customer actions and admin revision history", async () => {
  const b = await booking();
  let q = await create(b);
  const linkedConversation = await db
    .selectFrom("conversations")
    .select("id")
    .where("booking_request_id", "=", b.id)
    .executeTakeFirstOrThrow();
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
  assert.equal(
    (await call(`/quotations/${q.id}`, "GET", undefined, customerCookie))
      .status,
    404,
  );
  assert.equal(
    (
      await call(
        `/admin/booking-requests/${b.id}/quotations`,
        "POST",
        { expectedUpdatedAt: b.updatedAt },
        customerCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/admin/quotations/${q.id}`,
        "PATCH",
        { expectedUpdatedAt: q.updatedAt, items: [] },
        customerCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/admin/quotations/${q.id}/send`,
        "POST",
        { expectedUpdatedAt: q.updatedAt },
        customerCookie,
      )
    ).status,
    403,
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
  const beforeDelivery = await read(
    await call(`/admin/conversations/${linkedConversation.id}`),
    200,
  );
  assert.equal(beforeDelivery.conversation.aiEnabled, true);
  assert.equal(beforeDelivery.conversation.aiVersion, 0);
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  const afterDelivery = await read(
    await call(`/admin/conversations/${linkedConversation.id}`),
    200,
  );
  assert.equal(afterDelivery.conversation.aiEnabled, false);
  assert.equal(afterDelivery.conversation.aiVersion, 1);
  const msg = await db
    .selectFrom("messages")
    .selectAll()
    .where("quotation_id", "=", q.id)
    .execute();
  assert.equal(msg.length, 1);
  assert.equal(
    (await call(`/quotations/${q.id}`, "GET", undefined, customerCookie))
      .status,
    200,
  );
  assert.equal(
    (await call(`/quotations/${q.id}`, "GET", undefined, otherCookie)).status,
    404,
  );
  const beforeQuotes = await db
    .selectFrom("quotations")
    .selectAll()
    .where("booking_request_id", "=", b.id)
    .execute();
  const beforeAudits = await db
    .selectFrom("audit_events")
    .selectAll()
    .where("entity_type", "=", "quotation")
    .execute();

  for (const action of ["accept", "revision"]) {
    assert.equal(
      (
        await call(
          `/quotations/${q.id}/${action}`,
          "POST",
          { expectedUpdatedAt: q.updatedAt, reason: "Change terms" },
          customerCookie,
        )
      ).status,
      404,
    );
  }

  assert.equal(
    (
      await call(
        `/admin/quotations/${q.id}/revision`,
        "POST",
        { expectedUpdatedAt: q.updatedAt, reason: "Change terms" },
        customerCookie,
      )
    ).status,
    403,
  );
  assert.deepEqual(
    await db
      .selectFrom("quotations")
      .selectAll()
      .where("booking_request_id", "=", b.id)
      .execute(),
    beforeQuotes,
  );
  assert.deepEqual(
    await db
      .selectFrom("audit_events")
      .selectAll()
      .where("entity_type", "=", "quotation")
      .execute(),
    beforeAudits,
  );
  const conversation = await db
    .selectFrom("conversations")
    .select("id")
    .where("booking_request_id", "=", b.id)
    .executeTakeFirstOrThrow();
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "Please change the offer.", conversationId: conversation.id },
      customerCookie,
    ),
    201,
  );
  await read(
    await call(`/admin/conversations/${conversation.id}/messages`, "POST", {
      body: "Let's discuss this offer.",
    }),
    201,
  );
  assert.deepEqual(
    await db
      .selectFrom("quotations")
      .selectAll()
      .where("booking_request_id", "=", b.id)
      .execute(),
    beforeQuotes,
  );
  assert.deepEqual(
    await db
      .selectFrom("audit_events")
      .selectAll()
      .where("entity_type", "=", "quotation")
      .execute(),
    beforeAudits,
  );
  await read(
    await call(`/admin/quotations/${q.id}/revision`, "POST", {
      expectedUpdatedAt: q.updatedAt,
      reason: "Change terms",
    }),
    201,
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

test("old active booking conversations receive exact quotation versions", async () => {
  for (const pastEnd of [false, true]) {
    const b = await booking();
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const conversation = await db
      .selectFrom("conversations")
      .select("id")
      .where("booking_request_id", "=", b.id)
      .executeTakeFirstOrThrow();
    await db
      .updateTable("conversations")
      .set({ created_at: old })
      .where("id", "=", conversation.id)
      .execute();

    if (pastEnd) {
      await db
        .updateTable("booking_requests")
        .set({ starts_at: new Date(old.getTime() - 3600000), ends_at: old })
        .where("id", "=", b.id)
        .execute();
    }

    let q = await create(b);
    q = (
      await read(
        await call(`/admin/quotations/${q.id}`, "PATCH", {
          expectedUpdatedAt: q.updatedAt,
          items: [],
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
    assert.equal(q.status, "sent");
    const messages = await db
      .selectFrom("messages")
      .selectAll()
      .where("quotation_id", "=", q.id)
      .execute();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].conversation_id, conversation.id);
    assert.equal(messages[0].sender_role, "admin");
    const audits = await db
      .selectFrom("audit_events")
      .selectAll()
      .where("entity_id", "=", q.id)
      .where("action", "=", "quotation.sent")
      .execute();
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actor_id, messages[0].sender_id);
  }
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

test("requested-day changes preserve the sent price", async () => {
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
  const current = (
    await read(
      await call(`/quotations/${q.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).quotation;
  assert.equal(current.status, "sent");
  assert.equal(current.totalAmountMinor, q.totalAmountMinor);
});

test("another admin edits, sends and revises with audit", async () => {
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
    const conversation = await db
      .selectFrom("conversations")
      .select(["ai_enabled", "ai_version"])
      .where("booking_request_id", "=", b.id)
      .executeTakeFirstOrThrow();
    assert.deepEqual(conversation, { ai_enabled: true, ai_version: 0 });
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
  const pkg = await db
    .insertInto("packages")
    .values({
      name: "Financial history",
      slug: `financial-${randomUUID()}`,
      price: 1000,
      max_guests: 100,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const service = await db
    .insertInto("services")
    .values({
      name: "Original service",
      slug: `financial-service-${randomUUID()}`,
      description: "Original coverage",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const b = await booking(pkg.id);
  let q = await create(b);
  const items = [
    {
      id: randomUUID(),
      direction: "deduct",
      kind: "deduction",
      description: "Agreed discount",
      amountMinor: 20000,
      serviceId: null,
    },
  ];
  q = (
    await read(
      await call(`/admin/quotations/${q.id}`, "PATCH", {
        expectedUpdatedAt: q.updatedAt,
        items,
      }),
      200,
    )
  ).quotation;
  await db
    .updateTable("packages")
    .set({ name: "Changed proposal", price: 1500, updated_at: new Date() })
    .where("id", "=", pkg.id)
    .execute();
  await db
    .updateTable("services")
    .set({
      description: "Changed coverage",
      archived_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", service.id)
    .execute();
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  q = (
    await read(
      await call(`/quotations/${q.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).quotation;
  assert.equal(q.status, "sent");
  assert.equal("acceptedAt" in q, false);
  assert.equal(q.baseAmountMinor, 100000);
  assert.equal(q.totalAmountMinor, 80000);
  assert.deepEqual(q.items, items);
  assert.equal(q.offeredPackageId, pkg.id);

  for (const field of [
    "offeredPackageUpdatedAt",
    "offeredPackageTerms",
    "basisCurrent",
  ])
    assert.equal(field in q, false);

  let revised = (
    await read(
      await call(`/admin/quotations/${q.id}/revision`, "POST", {
        expectedUpdatedAt: q.updatedAt,
        reason: "Offer the updated package price",
      }),
      201,
    )
  ).quotation;
  assert.equal(revised.baseAmountMinor, 150000);
  assert.equal(revised.totalAmountMinor, 130000);
  assert.deepEqual(revised.items, items);
  assert.equal(revised.adjustmentsReviewed, false);
  assert.equal(
    (
      await call(`/admin/quotations/${revised.id}/send`, "POST", {
        expectedUpdatedAt: revised.updatedAt,
      })
    ).status,
    409,
  );
  revised = (
    await read(
      await call(`/admin/quotations/${revised.id}`, "PATCH", {
        expectedUpdatedAt: revised.updatedAt,
        items,
      }),
      200,
    )
  ).quotation;
  await read(
    await call(`/admin/quotations/${revised.id}/send`, "POST", {
      expectedUpdatedAt: revised.updatedAt,
    }),
    200,
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
  assert.equal(history[0].status, "sent");
  assert.equal(history[1].status, "superseded");
  assert.ok(history[1].supersededAt);
  assert.equal(history[1].baseAmountMinor, 100000);
  assert.equal(history[1].totalAmountMinor, 80000);
  assert.deepEqual(history[1].items, items);
  const audit = await db
    .selectFrom("audit_events")
    .select("action")
    .where("entity_id", "=", q.id)
    .execute();
  assert(audit.some((row) => row.action === "quotation.sent"));
});

test("schedule and timezone changes do not alter saved amounts", async () => {
  const b = await booking();
  await db
    .updateTable("booking_requests")
    .set({ requested_days: null, status: "accepted" })
    .where("id", "=", b.id)
    .execute();
  const day = await db
    .insertInto("events_day")
    .values({
      booking_request_id: b.id,
      day: "2099-01-01",
      starts_at: new Date("2099-01-01T01:00:00Z"),
      ends_at: new Date("2099-01-01T03:00:00Z"),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const latest = (
    await read(
      await call(`/booking-requests/${b.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).bookingRequest;
  let q = await create(latest);
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  await db
    .updateTable("events_day")
    .set({ status: "cancelled" })
    .where("id", "=", day.id)
    .execute();
  await db
    .updateTable("booking_requests")
    .set({ time_zone: "Asia/Tokyo" })
    .where("id", "=", b.id)
    .execute();
  const current = (
    await read(
      await call(`/quotations/${q.id}`, "GET", undefined, customerCookie),
      200,
    )
  ).quotation;
  assert.equal(current.status, "sent");
  assert.equal(current.totalAmountMinor, q.totalAmountMinor);
});

test("private package edits remain visible separately while quotations retain their own amounts", async () => {
  const b = await booking();
  const before = await read(
    await call(`/admin/booking-requests/${b.id}/package`),
    200,
  );
  const content = {
    name: "Private proposal",
    description: "Current description",
    maxGuests: 100,
    price: { kind: "fixed", currency: "PHP", amountMinor: 120000 },
    sections: [],
  };
  const custom = await read(
    await call(`/admin/booking-requests/${b.id}/custom-package`, "POST", {
      ...content,
      expectedUpdatedAt: before.package.updatedAt,
      expectedBookingUpdatedAt: before.bookingUpdatedAt,
    }),
    200,
  );
  let q = await create(custom.bookingRequest);
  assert.equal(q.offeredPackageId, custom.package.id);
  const edited = await read(
    await call(`/admin/booking-requests/${b.id}/custom-package`, "PATCH", {
      ...content,
      description: "Updated description",
      price: { kind: "fixed", currency: "PHP", amountMinor: 180000 },
      expectedUpdatedAt: custom.package.updatedAt,
      expectedBookingUpdatedAt: custom.bookingRequest.updatedAt,
    }),
    200,
  );
  q = (
    await read(
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      }),
      200,
    )
  ).quotation;
  const current = await read(
    await call(
      `/booking-requests/${b.id}/package`,
      "GET",
      undefined,
      customerCookie,
    ),
    200,
  );
  assert.equal(current.package.description, "Updated description");
  assert.equal(current.package.price.amountMinor, 180000);
  assert.equal(q.totalAmountMinor, 120000);
  assert.equal(
    (
      await read(
        await call(`/quotations/${q.id}`, "GET", undefined, customerCookie),
        200,
      )
    ).quotation.totalAmountMinor,
    120000,
  );
  assert.equal(edited.bookingRequest.packageId, b.packageId);
});

test("quotation and package histories paginate independently without losing current versions", async () => {
  const b = await booking();
  const current = await create(b);
  await pool.query(
    `INSERT INTO quotations (booking_request_id,version,currency,base_amount_minor,total_amount_minor,items,status,created_by,sent_at,offered_package_id,adjustments_reviewed)
    SELECT q.booking_request_id, n, q.currency, q.base_amount_minor, q.total_amount_minor, q.items,
      CASE WHEN n = 2 THEN 'sent' ELSE 'superseded' END, q.created_by, now(), q.offered_package_id, true
    FROM quotations q CROSS JOIN generate_series(2, 35) n WHERE q.id = $1`,
    [current.id],
  );
  const base = `/admin/booking-requests/${b.id}/quotations?limit=10`;
  const first = await read(await call(base), 200);
  assert.equal(first.quotations.length, 10);
  assert.equal(first.currentDraft.id, current.id);
  assert.equal(first.currentOffer.version, 2);
  assert.ok(first.nextCursor);
  const second = await read(
    await call(`${base}&cursor=${encodeURIComponent(first.nextCursor)}`),
    200,
  );
  assert.equal(second.quotations[0].version, 25);
  assert.equal(second.currentDraft.id, current.id);
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
  assert.equal(customer.currentDraft, null);
  assert.equal(customer.currentOffer.version, 2);
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
  assert.equal(
    (
      await call(`/admin/booking-requests/${b.id}/quotations`, "POST", {
        expectedUpdatedAt: b.updatedAt,
      })
    ).status,
    409,
  );
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
  await create(result.bookingRequest);
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

test("quotation delivery clears pending handoff only on a successful committed admin response", async () => {
  const b = await booking();
  const q = await create(b);
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
  await pool.query(
    "CREATE FUNCTION reject_handoff_quote_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.quotation_id IS NOT NULL THEN RAISE EXCEPTION 'fixture delivery failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_handoff_quote_test BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION reject_handoff_quote_test()",
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
    const failed = await db
      .selectFrom("conversations")
      .select(["ai_handoff", "ai_version"])
      .where("booking_request_id", "=", b.id)
      .executeTakeFirstOrThrow();
    assert.deepEqual(failed, { ai_handoff: pending, ai_version: 1 });
  } finally {
    await pool.query("DROP TRIGGER reject_handoff_quote_test ON messages");
    await pool.query("DROP FUNCTION reject_handoff_quote_test()");
  }

  assert.equal(
    (
      await call(`/admin/quotations/${q.id}/send`, "POST", {
        expectedUpdatedAt: q.updatedAt,
      })
    ).status,
    200,
  );
  const sent = await db
    .selectFrom("conversations")
    .select(["ai_handoff", "ai_enabled", "ai_version"])
    .where("booking_request_id", "=", b.id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(sent, {
    ai_handoff: { ...pending, pending: false },
    ai_enabled: false,
    ai_version: 2,
  });
});
