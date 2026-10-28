import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/lib/session.js";

const database = `em_messages_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let customerCookie: string;
let otherCustomerCookie: string;
let customerId: string;
let otherCustomerId: string;

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

  async function session(role: string, name: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({ email: `${role}-${randomUUID()}@example.test`, display_name: name, password_hash: "unused", role })
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

  ({ cookie: adminCookie } = await session("admin", "Admin Person"));
  const customer = await session("customer", "Customer One");
  customerCookie = customer.cookie;
  customerId = customer.id;
  const other = await session("customer", "Customer Two");
  otherCustomerCookie = other.cookie;
  otherCustomerId = other.id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(path: string, method = "GET", body?: unknown, cookie?: string) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

test("customer and staff conversations enforce roles and validate messages", async () => {
  await read(await call("/messages/conversation"), 401);
  await read(await call("/admin/conversations"), 401);
  await read(await call("/messages/conversation", "GET", undefined, adminCookie), 403);
  await read(await call("/admin/conversations", "GET", undefined, customerCookie), 403);
  await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);

  const empty = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  assert.equal(empty.messages.length, 0);
  assert.equal(empty.conversation.customerId, customerId);
  assert.equal(empty.conversation.customerName, "Customer One");
  assert.equal(empty.conversation.unreadCount, 0);
  const again = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  assert.equal(again.conversation.id, empty.conversation.id);

  await read(await call("/messages/conversation/messages", "POST", { body: "   " }, customerCookie), 400);
  await read(await call("/messages/conversation/messages", "POST", { body: "x".repeat(4001) }, customerCookie), 400);
  await read(await call("/messages/conversation/messages", "POST", { body: "No session" }), 401);
  await read(await call("/messages/conversation/messages", "POST", { body: "Admin cannot use customer route" }, adminCookie), 403);

  const sent = await read(
    await call("/messages/conversation/messages", "POST", { body: "  Hello team  " }, customerCookie),
    201,
  );
  assert.equal(sent.message.body, "Hello team");
  assert.equal(sent.message.senderRole, "customer");
  assert.equal(sent.message.senderId, customerId);
  assert.equal(sent.message.senderName, "Customer One");
  assert.equal(sent.message.readAt, null);

  const list = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(list.conversations.length, 1);
  assert.equal(list.conversations[0].id, empty.conversation.id);
  assert.equal(list.conversations[0].unreadCount, 1);
  assert.equal(list.conversations[0].lastMessage.body, "Hello team");

  const thread = await read(
    await call(`/admin/conversations/${empty.conversation.id}`, "GET", undefined, adminCookie),
    200,
  );
  assert.equal(thread.messages.length, 1);
  assert.ok(thread.messages[0].readAt);
  assert.equal(thread.conversation.unreadCount, 0);
  assert.equal(
    (await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200)).conversations[0]
      .unreadCount,
    0,
  );

  const reply = await read(
    await call(`/admin/conversations/${empty.conversation.id}/messages`, "POST", { body: " We can help " }, adminCookie),
    201,
  );
  assert.equal(reply.message.body, "We can help");
  assert.equal(reply.message.senderRole, "admin");
  assert.equal(reply.message.senderName, "Admin Person");
  assert.equal(reply.message.readAt, null);

  const customerThread = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.deepEqual(
    customerThread.messages.map((message: any) => message.body).sort(),
    ["Hello team", "We can help"],
  );
  assert.ok(customerThread.messages.find((message: any) => message.senderRole === "admin").readAt);

  await read(
    await call("/messages/conversation/messages", "POST", { body: "One more question" }, customerCookie),
    201,
  );
  const unread = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(unread.conversations[0].unreadCount, 1);
  assert.equal(unread.conversations[0].lastMessage.body, "One more question");
});

test("conversations are isolated per customer and unknown ids return 404", async () => {
  const other = await read(await call("/messages/conversation", "GET", undefined, otherCustomerCookie), 200);
  assert.equal(other.conversation.customerId, otherCustomerId);
  assert.equal(other.messages.length, 0);

  await read(
    await call("/messages/conversation/messages", "POST", { body: "Second customer here" }, otherCustomerCookie),
    201,
  );

  const list = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(list.conversations.length, 2);
  assert.equal(list.conversations.filter((item: any) => item.unreadCount === 1).length, 2);

  const mine = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  assert.ok(mine.messages.every((message: any) => message.body !== "Second customer here"));

  await read(
    await call(`/admin/conversations/${randomUUID()}`, "GET", undefined, adminCookie),
    404,
  );
  await read(
    await call(`/admin/conversations/${randomUUID()}/messages`, "POST", { body: "hello" }, adminCookie),
    404,
  );
});

test("message routes appear in the OpenAPI document", async () => {
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/messages/conversation"].get);
  assert.ok(spec.paths["/v1/messages/conversation/messages"].post);
  assert.ok(spec.paths["/v1/admin/conversations"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}/messages"].post);
});
