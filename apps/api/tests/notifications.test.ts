import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { notificationPageSchema } from "@event-management/contracts/notifications";
import type {
  Quotation,
  QuotationPreparation,
} from "@event-management/contracts/quotations";
import { sql } from "kysely";
import { Pool } from "pg";
import { matchRouteFamily } from "../src/edge/match-route.js";
import { startToolCallData } from "../src/data/ai/start-tool-call.js";
import { requestHumanHandoffData } from "../src/data/messages/request-human-handoff.js";
import { createNotificationData } from "../src/data/notifications/create-notification.js";
import { hashSessionToken } from "../src/utils/session.js";
import { setTestConfig, testDatabaseUrl } from "./helpers/set-test-config.js";

const database = `em_notification_test_${randomUUID().replaceAll("-", "")}`;

type Account = { id: string; cookie: string };

let db: typeof import("../src/db/client.js").db;
let app: typeof import("../src/app.js").app;
let edge: typeof import("../src/edge/server.js").app;
let adminPool: Pool;
let pool: Pool;

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

  setTestConfig({ SUPABASE_DB_URL: testDatabaseUrl(database) });
  ({ app } = await import("../src/app.js"));
  ({ app: edge } = await import("../src/edge/server.js"));
  ({ db } = await import("../src/db/client.js"));
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
  viewer?: Account,
  method = "GET",
  body?: unknown,
  runtime = app,
) {
  return runtime.request(`/v1${path}`, {
    method,
    headers: {
      ...(viewer ? { Cookie: viewer.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function expectStatus(response: Response, status: number) {
  assert.equal(response.status, status, await response.clone().text());

  return response;
}

async function notifications(viewer: Account, cursor?: string, runtime = app) {
  const query = new URLSearchParams({
    includeBookingDetails: "1",
    includeQuotationDetails: "1",
  });

  if (cursor) query.set("cursor", cursor);

  const response = await expectStatus(
    await call(`/notifications?${query}`, viewer, "GET", undefined, runtime),
    200,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");

  return notificationPageSchema.parse(await response.json());
}

const bookingInput = {
  eventType: "Wedding",
  durationMode: "one_day",
  requestedDays: [{ date: "2099-06-01" }],
  timeZone: "Asia/Manila",
  contactName: "Private Contact",
  phoneNumber: "123456789",
  specialRequests: "Private event details",
};

async function createBooking(customer: Account, packageId?: string) {
  const result = await expectStatus(
    await call("/booking-requests", customer, "POST", {
      ...bookingInput,
      packageId,
    }),
    201,
  );
  const { bookingRequest } = (await result.json()) as {
    bookingRequest: { id: string; reference: string };
  };

  return bookingRequest;
}

test("booking creation fans out private notifications and status changes notify only the owner", async () => {
  const first = await account("admin");
  const second = await account("admin");
  const customer = await account("customer");
  const unrelated = await account("customer");
  const booking = await createBooking(customer);

  const firstPage = await notifications(first);
  const secondPage = await notifications(second);
  assert.equal(firstPage.unreadCount, 1);
  assert.equal(secondPage.unreadCount, 1);
  const firstNotice = firstPage.notifications[0];
  const secondNotice = secondPage.notifications[0];
  assert.equal(firstNotice.type, "booking_request_created");
  assert.equal(secondNotice.type, "booking_request_created");
  assert.deepEqual(firstNotice.booking, {
    eventType: bookingInput.eventType,
    preferredDate: bookingInput.requestedDays[0].date,
  });
  assert.deepEqual(secondNotice.booking, firstNotice.booking);
  const legacyResponse = await expectStatus(
    await call("/notifications", first),
    200,
  );
  const legacyPage = notificationPageSchema.parse(await legacyResponse.json());
  assert.equal("booking" in legacyPage.notifications[0], false);
  assert.deepEqual(firstNotice.payload, {
    bookingRequestId: booking.id,
    bookingReference: booking.reference,
  });
  assert.deepEqual(secondNotice.payload, firstNotice.payload);
  assert.notEqual(firstNotice.id, secondNotice.id);
  assert.deepEqual(await notifications(customer), {
    notifications: [],
    unreadCount: 0,
    nextCursor: null,
  });
  await expectStatus(await call("/notifications"), 401);
  await expectStatus(
    await call(`/notifications/${firstNotice.id}/read`, undefined, "POST", {}),
    401,
  );
  await expectStatus(
    await call(`/notifications/${firstNotice.id}/read`, second, "POST", {}),
    404,
  );
  await expectStatus(
    await call(`/notifications/${randomUUID()}/read`, first, "POST", {}),
    404,
  );
  await expectStatus(
    await call(`/notifications/${firstNotice.id}/read`, first, "POST", {}),
    204,
  );
  const readPage = await notifications(first);
  assert.ok(readPage.notifications[0].readAt);
  assert.equal(readPage.unreadCount, 0);
  await expectStatus(
    await call(`/notifications/${firstNotice.id}/read`, first, "POST", {}),
    204,
  );
  assert.deepEqual(await notifications(first), readPage);
  assert.deepEqual(await notifications(second), secondPage);

  const statusPath = `/admin/booking-requests/${booking.id}/status`;
  const patch = { status: "needs_details", reason: "Private admin reason" };
  await expectStatus(await call(statusPath, unrelated, "PATCH", patch), 403);
  await expectStatus(await call(statusPath, first, "PATCH", patch), 200);
  await expectStatus(await call(statusPath, first, "PATCH", patch), 409);

  const customerPage = await notifications(customer);
  assert.equal(customerPage.unreadCount, 1);
  const statusNotice = customerPage.notifications[0];
  assert.equal(statusNotice.type, "booking_status_updated");
  assert.deepEqual(statusNotice.booking, firstNotice.booking);
  assert.deepEqual(statusNotice.payload, {
    ...firstNotice.payload,
    status: patch.status,
  });
  assert.deepEqual(await notifications(first), readPage);
  assert.deepEqual(await notifications(second), secondPage);
  assert.equal((await notifications(unrelated)).unreadCount, 0);

  const history = await db
    .selectFrom("booking_request_status_history")
    .select("id")
    .where("booking_request_id", "=", booking.id)
    .where("status", "=", patch.status)
    .executeTakeFirstOrThrow();
  const source = await db
    .selectFrom("notifications")
    .select("source_event_id")
    .where("id", "=", customerPage.notifications[0].id)
    .executeTakeFirstOrThrow();
  assert.equal(source.source_event_id, history.id);

  await expectStatus(
    await call(`/booking-requests/${booking.id}/cancel`, customer, "PATCH", {
      reason: "Customer changed plans",
    }),
    200,
  );
  assert.deepEqual(await notifications(customer), customerPage);
  assert.deepEqual(await notifications(second), secondPage);
});

test("older booking notifications without an accessible booking still load", async () => {
  const admin = await account("admin");
  const owner = await account("customer");
  const viewer = await account("customer");
  const booking = await createBooking(owner);
  const references = [
    { bookingRequestId: booking.id, bookingReference: booking.reference },
    { bookingRequestId: randomUUID(), bookingReference: "Legacy reference" },
  ];

  await db.transaction().execute(async (trx) => {
    for (const reference of references)
      await createNotificationData(trx, { userId: viewer.id }, randomUUID(), {
        type: "booking_status_updated",
        payload: { ...reference, status: "needs_details" },
      });
  });

  const page = await notifications(viewer, undefined, edge);
  assert.equal(page.unreadCount, references.length);

  for (const item of page.notifications) {
    assert.equal(item.type, "booking_status_updated");
    assert.equal(item.booking, undefined);
  }

  const persisted = await db
    .selectFrom("notifications")
    .select("payload")
    .where("recipient_user_id", "=", admin.id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(persisted.payload, references[0]);
});

test("Node and Edge paginate an account's own notifications and keep exact ordering for timestamp ties", async () => {
  const customer = await account("customer");
  const other = await account("customer");

  const sourceIds = Array.from({ length: 24 }, () => randomUUID());

  await db
    .insertInto("notifications")
    .values(
      sourceIds.map((id, index) => ({
        id,
        recipient_user_id: customer.id,
        type: "human_review_requested",
        source_event_id: id,
        payload: { conversationId: id },
        created_at:
          index < 22
            ? "2026-11-21T01:00:00.123456Z"
            : "2026-11-21T01:00:00.123455Z",
      })),
    )
    .execute();
  const first = await notifications(customer);
  assert.equal(first.notifications.length, 20);
  assert.equal(first.unreadCount, 24);
  assert.ok(first.nextCursor);
  assert.deepEqual(first, await notifications(customer, undefined, edge));
  const second = await notifications(customer, first.nextCursor, edge);
  assert.equal(second.unreadCount, 24);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(
    [...first.notifications, ...second.notifications].map((row) => row.id),
    [
      ...sourceIds.slice(0, 22).sort().reverse(),
      ...sourceIds.slice(22).sort().reverse(),
    ],
  );
  await expectStatus(
    await call(`/notifications?cursor=${first.nextCursor}`, other),
    400,
  );
  await expectStatus(
    await call("/notifications?cursor=invalid", customer),
    400,
  );
  await expectStatus(
    await call(
      `/notifications/${first.notifications[0].id}/read`,
      customer,
      "POST",
      {},
      edge,
    ),
    204,
  );
  assert.equal((await notifications(customer)).unreadCount, 23);
  assert.equal(matchRouteFamily("/v1/notifications"), "notifications");
  assert.equal(matchRouteFamily("/v1/notifications-fake"), null);

  for (const runtime of [app, edge]) {
    const response = await runtime.request("/openapi.json");
    assert.equal(response.status, 200);
    const { paths } = (await response.json()) as {
      paths: Record<string, unknown>;
    };
    assert.ok(paths["/v1/notifications"]);
    assert.ok(paths["/v1/notifications/{id}/read"]);
  }
});

test("quotation delivery alerts the customer to each saved version once and skips failed delivery", async () => {
  const admin = await account("admin");
  const customer = await account("customer");
  const pkg = await db
    .insertInto("packages")
    .values({
      slug: `notifications-${randomUUID()}`,
      name: "Quotation package",
      max_guests: 100,
      price: 1000,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const booking = await createBooking(customer, pkg.id);
  const conversation = await db
    .selectFrom("conversations")
    .select("id")
    .where("booking_request_id", "=", booking.id)
    .executeTakeFirstOrThrow();
  const base = `/admin/booking-requests/${booking.id}/quotations`;

  async function prepare() {
    const response = await expectStatus(
      await call(`${base}/prepare`, admin),
      200,
    );
    const { preparation } = (await response.json()) as {
      preparation: QuotationPreparation;
    };
    const {
      expectedBookingUpdatedAt,
      packageId,
      expectedPackageUpdatedAt,
      currentOffer,
    } = preparation;

    return {
      requestId: randomUUID(),
      expectedBookingUpdatedAt,
      packageId,
      expectedPackageUpdatedAt,
      currentOffer,
      revisionReason: currentOffer ? "Requested changes" : null,
      items: [],
    };
  }

  const request = await prepare();

  const send = (body: unknown) => call(`${base}/send`, admin, "POST", body);

  const response = await expectStatus(await send(request), 200);
  const { quotation } = (await response.json()) as { quotation: Quotation };
  await expectStatus(await send(request), 200);
  const revision = await prepare();
  await expectStatus(await send(revision), 200);
  const page = await notifications(customer);
  assert.equal(page.unreadCount, 2);

  for (const item of page.notifications) {
    assert.equal(item.type, "quotation_sent");
    assert.deepEqual(item.booking, {
      eventType: bookingInput.eventType,
      preferredDate: bookingInput.requestedDays[0].date,
    });
  }

  const withoutDetails = notificationPageSchema.parse(
    await (
      await expectStatus(await call("/notifications", customer), 200)
    ).json(),
  );
  assert.ok(withoutDetails.notifications.every((item) => !("booking" in item)));
  const withLegacyOptIn = notificationPageSchema.parse(
    await (
      await expectStatus(
        await call("/notifications?includeBookingDetails=1", customer),
        200,
      )
    ).json(),
  );
  assert.deepEqual(withLegacyOptIn, withoutDetails);
  assert.deepEqual(
    page.notifications.map(({ type, payload }) => ({ type, payload })),
    [
      {
        type: "quotation_sent",
        payload: {
          quotationId: revision.requestId,
          version: 2,
          conversationId: conversation.id,
        },
      },
      {
        type: "quotation_sent",
        payload: {
          quotationId: quotation.id,
          version: 1,
          conversationId: conversation.id,
        },
      },
    ],
  );

  const withoutConversation = await createBooking(customer, pkg.id);
  const failedBase = `/admin/booking-requests/${withoutConversation.id}/quotations`;
  const failed = await expectStatus(
    await call(`${failedBase}/prepare`, admin),
    200,
  );
  const { preparation } = (await failed.json()) as {
    preparation: QuotationPreparation;
  };
  await db
    .deleteFrom("conversations")
    .where("booking_request_id", "=", withoutConversation.id)
    .execute();
  const requestId = randomUUID();
  const {
    expectedBookingUpdatedAt,
    packageId,
    expectedPackageUpdatedAt,
    currentOffer,
  } = preparation;
  await expectStatus(
    await call(`${failedBase}/send`, admin, "POST", {
      requestId,
      expectedBookingUpdatedAt,
      packageId,
      expectedPackageUpdatedAt,
      currentOffer,
      revisionReason: null,
      items: [],
    }),
    409,
  );
  assert.equal(
    await db
      .selectFrom("quotations")
      .select("id")
      .where("id", "=", requestId)
      .executeTakeFirst(),
    undefined,
  );
  assert.deepEqual(await notifications(customer), page);

  const other = await account("customer");
  const originalNotice = page.notifications[1];
  assert.equal(originalNotice.type, "quotation_sent");
  const mismatchedConversation = await db
    .insertInto("conversations")
    .values({ customer_id: customer.id })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.transaction().execute((trx) =>
    createNotificationData(trx, { userId: other.id }, quotation.id, {
      type: originalNotice.type,
      payload: originalNotice.payload,
    }),
  );
  const foreignPage = await notifications(other, undefined, edge);
  assert.equal("booking" in foreignPage.notifications[0], false);

  await db
    .updateTable("notifications")
    .set("payload", {
      ...originalNotice.payload,
      conversationId: mismatchedConversation.id,
    })
    .where("id", "=", originalNotice.id)
    .execute();
  const mismatched = await notifications(customer);
  assert.equal(mismatched.unreadCount, 2);
  assert.equal(mismatched.notifications[1].id, originalNotice.id);
  assert.equal("booking" in mismatched.notifications[1], false);
  assert.deepEqual(mismatched.notifications[0], page.notifications[0]);

  await db
    .updateTable("notifications")
    .set("payload", originalNotice.payload)
    .where("id", "=", originalNotice.id)
    .execute();
  await db
    .deleteFrom("messages")
    .where("quotation_id", "=", quotation.id)
    .execute();
  const missingMessage = await notifications(customer, undefined, edge);
  assert.equal(missingMessage.unreadCount, 2);
  assert.equal("booking" in missingMessage.notifications[1], false);
  assert.deepEqual(
    missingMessage.notifications[1].payload,
    originalNotice.payload,
  );
});

test("successful customer and guest handoffs notify admins once and stale execution adds nothing", async () => {
  const admin = await account("admin");
  const customer = await account("customer");

  for (const guest of [false, true]) {
    const guestIdentityId = guest
      ? (
          await db
            .insertInto("guest_chat_identities")
            .values({
              token_hash: hashSessionToken(randomUUID()),
            })
            .returning("id")
            .executeTakeFirstOrThrow()
        ).id
      : undefined;
    const customerId = guest ? null : customer.id;
    const { id: conversationId } = await db
      .insertInto("conversations")
      .values({
        customer_id: customerId,
        guest_identity_id: guestIdentityId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id: customerMessageId } = await db
      .insertInto("messages")
      .values({
        conversation_id: conversationId,
        sender_id: customerId,
        sender_role: "customer",
        guest_origin: guest,
        body: "Private inquiry",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    async function handoff(aiVersion: number) {
      const turnId = randomUUID();
      const handoff = {
        reason: "customer_requested",
        summary: "Private request",
        pending: true,
      } as const;
      const { id: callId } = await startToolCallData(db, {
        turnId,
        toolCallId: "test",
        customerMessageId,
        toolName: "requestHumanHandoff",
        input: handoff,
      });

      return requestHumanHandoffData({
        db,
        scope: {
          conversationId,
          customerId,
          guestIdentityId,
          customerMessageId,
          aiVersion,
        },
        handoff,
        callId,
        turnId,
      });
    }

    const before = await notifications(admin);
    await assert.rejects(handoff(99), /no longer active/);
    assert.deepEqual(await notifications(admin), before);
    const reply = await handoff(0);
    assert.equal((await handoff(0)).id, reply.id);
    const after = await notifications(admin);
    assert.equal(after.unreadCount, before.unreadCount + 1);
    assert.equal(after.notifications[0].type, "human_review_requested");
    assert.deepEqual(after.notifications[0].payload, { conversationId });
    const row = await db
      .selectFrom("notifications")
      .select("source_event_id")
      .where("id", "=", after.notifications[0].id)
      .executeTakeFirstOrThrow();
    assert.equal(row.source_event_id, customerMessageId);
  }

  assert.equal((await notifications(customer)).unreadCount, 0);
});

test("rolled-back writes leave no notification and replay preserves its read state", async () => {
  const admin = await account("admin");
  const sourceEventId = randomUUID();
  const content = {
    type: "human_review_requested",
    payload: { conversationId: randomUUID() },
  } as const;

  const write = () =>
    db
      .transaction()
      .execute((trx) =>
        createNotificationData(
          trx,
          { userId: admin.id },
          sourceEventId,
          content,
        ),
      );

  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await createNotificationData(
        trx,
        { userId: admin.id },
        sourceEventId,
        content,
      );
      throw new Error("Roll back this event");
    }),
    /Roll back this event/,
  );
  assert.equal((await notifications(admin)).unreadCount, 0);

  await write();
  const { id } = (await notifications(admin)).notifications[0];
  await expectStatus(
    await call(`/notifications/${id}/read`, admin, "POST", {}),
    204,
  );
  const readPage = await notifications(admin);
  await write();
  assert.deepEqual(await notifications(admin), readPage);

  const { rows } = await sql<{ relrowsecurity: boolean }>`
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notifications'::regclass
  `.execute(db);
  assert.equal(rows[0]?.relrowsecurity, true);

  const clientPermissions = await sql`
    SELECT grants.privilege_type
    FROM pg_class AS relation
    CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) AS grants
    LEFT JOIN pg_roles AS grantee ON grantee.oid = grants.grantee
    WHERE relation.oid = 'public.notifications'::regclass
      AND (grants.grantee = 0 OR grantee.rolname IN ('anon', 'authenticated'))
  `.execute(db);
  assert.deepEqual(clientPermissions.rows, []);
});
