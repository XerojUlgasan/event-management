import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import { threadSchema } from "../src/controllers/messages/schemas.js";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_guest_test_${randomUUID().replaceAll("-", "")}`;
const modelId = "fixture/text-model";
let admin: Pool;
let pool: Pool;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let customer: { id: string; cookie: string };
let other: { id: string; cookie: string };
let team: { id: string; cookie: string };
let model: MockLanguageModelV4;
let packageId: string;

function useReply(text: string) {
  model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
  globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV4({
    languageModels: { [modelId]: model },
  });
}

before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }
  process.env.DB_NAME = database;
  process.env.AI_GATEWAY_API_KEY = "fixture-key";
  process.env.TEXT_MODEL = modelId;
  useReply("Hello from AMAC AI");
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: "customer" | "admin") {
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
    return { id: user.id, cookie: `em_session=${token}` };
  }
  customer = await session("customer");
  other = await session("customer");
  team = await session("admin");
  packageId = (
    await db
      .insertInto("packages")
      .values({
        slug: `ai-context-${randomUUID()}`,
        name: "Private package marker",
        max_guests: 100,
        price: 1000,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
});

after(async () => {
  delete globalThis.AI_SDK_DEFAULT_PROVIDER;
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(path: string, cookie: string, body?: unknown) {
  return app.request(`/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status: number) {
  const value: any = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
async function guest(cookie = "") {
  const response = await call("/guest/conversation", cookie, {});
  const value = await read(response, 200);
  return {
    ...value,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}
function send(
  thread: any,
  body = "Hello",
  requestId = randomUUID(),
  cookie = thread.cookie,
) {
  return call(
    `/guest/conversations/${thread.conversation.id}/messages`,
    cookie,
    { body, requestId },
  );
}
async function expired(thread: any) {
  await db
    .updateTable("conversations")
    .set({ guest_expires_at: new Date(Date.now() - 1000) })
    .where("id", "=", thread.conversation.id)
    .execute();
}

test("bootstrap issues opaque httponly cookies, rejects caller-chosen identities, and reuses one active conversation under concurrency", async () => {
  const first = await guest("em_guest=attacker-chosen");
  assert.match(first.cookie, /^em_guest=[A-Za-z0-9_-]{43}$/);
  assert.equal(first.conversation.customerId, null);
  assert.equal(first.conversation.customerEmail, null);
  assert.equal(first.conversation.customerName, "Guest");
  threadSchema.parse(first);
  const results = await Promise.all(
    Array.from({ length: 8 }, () => guest(first.cookie)),
  );
  assert.ok(
    results.every((result) => result.conversation.id === first.conversation.id),
  );
  assert.equal(
    (
      await db
        .selectFrom("conversations")
        .select("id")
        .where("guest_identity_id", "is not", null)
        .where("status", "=", "active")
        .execute()
    ).length,
    1,
  );
  const unknown = await guest(`em_guest=${"A".repeat(43)}`);
  assert.notEqual(unknown.cookie, `em_guest=${"A".repeat(43)}`);
});

test("five customer writes and five AI replies are allowed; sixth is readable login_required; replay never calls provider again", async () => {
  useReply("Guest reply");
  const thread = await guest();
  let fifth: any;
  const requestId = randomUUID();
  for (let index = 0; index < 5; index++) {
    const result = await read(
      await send(
        thread,
        `Question ${index}`,
        index === 4 ? requestId : randomUUID(),
      ),
      201,
    );
    assert.equal(result.guest.remainingMessages, 4 - index);
    assert.equal(result.assistantMessage?.body, "Guest reply");
    assert.equal(
      Date.parse(result.guest.expiresAt),
      Date.parse(result.assistantMessage.createdAt) + 24 * 60 * 60 * 1000,
    );
    fifth = result;
  }
  assert.equal(fifth.guest.loginRequired, true);
  assert.equal(fifth.message.id, requestId);
  assert.equal(model.doGenerateCalls.length, 5);
  const replay = await read(await send(thread, "Question 4", requestId), 201);
  assert.equal(replay.message.id, fifth.message.id);
  assert.equal(replay.assistantMessage.id, fifth.assistantMessage.id);
  assert.equal(model.doGenerateCalls.length, 5);
  assert.equal(
    (await read(await send(thread, "Sixth"), 409)).code,
    "login_required",
  );
  assert.equal(
    (await read(await send(thread, "Changed", requestId), 409)).code,
    "request_conflict",
  );
  const readable = await read(
    await call(`/guest/conversations/${thread.conversation.id}`, thread.cookie),
    200,
  );
  assert.equal(readable.messages.length, 10);
  assert.equal(readable.conversation.status, "active");
  const provenance = await db
    .selectFrom("messages")
    .select(["sender_id", "guest_origin"])
    .where("conversation_id", "=", thread.conversation.id)
    .where("sender_role", "=", "customer")
    .execute();
  assert.ok(
    provenance.every((row) => row.sender_id === null && row.guest_origin),
  );
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.ok(!prompt.includes("Private package marker"));
  assert.ok(prompt.includes("bookingRequest"));
});

test("quota races serialize and concurrent request replays create one history entry and provider call", async () => {
  useReply("Race reply");
  const thread = await guest();
  const requestId = randomUUID();
  const duplicates = await Promise.all(
    Array.from({ length: 5 }, () => send(thread, "Same request", requestId)),
  );
  const values = await Promise.all(
    duplicates.map((response) => read(response, 201)),
  );
  assert.equal(new Set(values.map((value) => value.message.id)).size, 1);
  assert.equal(values[0].message.id, requestId);
  assert.ok(values.every((value) => value.guest.customerMessageCount === 1));
  assert.equal(model.doGenerateCalls.length, 1);
  const responses = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      send(thread, `Concurrent ${index}`),
    ),
  );
  assert.equal(
    responses.filter((response) => response.status === 201).length,
    4,
  );
  assert.equal(
    responses.filter((response) => response.status === 409).length,
    4,
  );
  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("conversation_id", "=", thread.conversation.id)
        .where("sender_role", "=", "customer")
        .execute()
    ).length,
    5,
  );
});

test("guest request IDs preserve historical reservations and reject global collisions without consuming quota", async () => {
  useReply("Collision test reply");
  const first = await guest();
  const second = await guest();
  const oldRequestId = randomUUID();
  const oldMessageId = randomUUID();
  await db
    .insertInto("messages")
    .values({
      id: oldMessageId,
      conversation_id: first.conversation.id,
      sender_id: null,
      sender_role: "customer",
      guest_origin: true,
      body: "Historical guest message",
    })
    .execute();
  await db
    .insertInto("guest_message_requests")
    .values({
      conversation_id: first.conversation.id,
      request_id: oldRequestId,
      message_id: oldMessageId,
      completed: true,
    })
    .execute();
  await db
    .updateTable("conversations")
    .set({ guest_customer_message_count: 1 })
    .where("id", "=", first.conversation.id)
    .execute();
  const historical = await read(
    await send(first, "Historical guest message", oldRequestId),
    201,
  );
  assert.equal(historical.message.id, oldMessageId);
  assert.equal(historical.guest.customerMessageCount, 1);
  assert.equal(model.doGenerateCalls.length, 0);

  const customerConversation = await db
    .insertInto("conversations")
    .values({ customer_id: customer.id })
    .returning("id")
    .executeTakeFirstOrThrow();
  const signedId = randomUUID();
  await db
    .insertInto("messages")
    .values({
      id: signedId,
      conversation_id: customerConversation.id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "Private signed message",
    })
    .execute();
  const signedCollision = await read(
    await send(second, "Attempt", signedId),
    409,
  );
  assert.equal(signedCollision.code, "request_conflict");
  assert.ok(
    !JSON.stringify(signedCollision).includes("Private signed message"),
  );
  assert.equal(
    (
      await db
        .selectFrom("conversations")
        .select("guest_customer_message_count")
        .where("id", "=", second.conversation.id)
        .executeTakeFirstOrThrow()
    ).guest_customer_message_count,
    0,
  );

  const sharedId = randomUUID();
  const collisions = await Promise.all([
    send(first, "Guest collision", sharedId),
    send(second, "Guest collision", sharedId),
  ]);
  assert.deepEqual(
    collisions.map((response) => response.status).sort(),
    [201, 409],
  );
  const conflict = await read(
    collisions[collisions[0].status === 409 ? 0 : 1],
    409,
  );
  assert.equal(conflict.code, "request_conflict");
  const counts = await db
    .selectFrom("conversations")
    .select(["id", "guest_customer_message_count"])
    .where("id", "in", [first.conversation.id, second.conversation.id])
    .execute();
  const loserId =
    collisions[0].status === 409
      ? first.conversation.id
      : second.conversation.id;
  assert.equal(
    counts.find((row) => row.id === loserId)?.guest_customer_message_count,
    loserId === first.conversation.id ? 1 : 0,
  );
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("id", "=", sharedId)
        .execute()
    ).length,
    1,
  );
});

test("provider failure is persisted and replay does not make another call or lose the saved message", async () => {
  useReply("unused");
  let calls = 0;
  model.doGenerate = async () => {
    calls++;
    throw Error("fixture failure");
  };
  const thread = await guest();
  const requestId = randomUUID();
  const first = await read(await send(thread, "Save me", requestId), 201);
  assert.equal(first.assistantMessage, null);
  assert.ok(first.assistantError);
  const replay = await read(await send(thread, "Save me", requestId), 201);
  assert.equal(replay.message.id, first.message.id);
  assert.equal(replay.assistantError, first.assistantError);
  assert.equal(calls, 1);
});

test("reads and AI preferences do not extend inactivity; messages from customer, assistant and admin do; expiration starts a fresh five", async () => {
  useReply("Sliding reply");
  const thread = await guest();
  const id = thread.conversation.id;
  const createdAt = (
    await db
      .selectFrom("conversations")
      .select("created_at")
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
  ).created_at;
  const early = new Date(Date.now() + 3600000);
  await db
    .updateTable("conversations")
    .set({ guest_expires_at: early })
    .where("id", "=", id)
    .execute();
  const readThread = await read(
    await call(`/guest/conversations/${id}`, thread.cookie),
    200,
  );
  assert.equal(readThread.guest.expiresAt, early.toISOString());
  await read(
    await app.request(`/v1/admin/conversations/${id}/ai`, {
      method: "PATCH",
      headers: { Cookie: team.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled: false, expectedAiVersion: 0 }),
    }),
    200,
  );
  assert.equal(
    (
      await db
        .selectFrom("conversations")
        .select("guest_expires_at")
        .where("id", "=", id)
        .executeTakeFirstOrThrow()
    ).guest_expires_at!.toISOString(),
    early.toISOString(),
  );
  const sent = await read(await send(thread), 201);
  assert.ok(Date.parse(sent.guest.expiresAt) > early.getTime());
  await db
    .updateTable("conversations")
    .set({ guest_expires_at: early })
    .where("id", "=", id)
    .execute();
  await read(
    await call(`/admin/conversations/${id}/messages`, team.cookie, {
      body: "Team reply",
    }),
    201,
  );
  const row = await db
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.ok(row.guest_expires_at!.getTime() > early.getTime());
  assert.equal(row.created_at.toISOString(), createdAt.toISOString());
  await expired(thread);
  assert.equal(
    (await read(await call(`/guest/conversations/${id}`, thread.cookie), 410))
      .code,
    "guest_expired",
  );
  assert.equal((await read(await send(thread), 410)).code, "guest_expired");
  await read(
    await call(`/admin/conversations/${id}/messages`, team.cookie, {
      body: "Too late",
    }),
    409,
  );
  const replacement = await guest(thread.cookie);
  assert.notEqual(replacement.conversation.id, id);
  assert.equal(replacement.guest.remainingMessages, 5);
  assert.equal(replacement.cookie, thread.cookie);
  const replacements = await Promise.all(
    Array.from({ length: 6 }, () => guest(thread.cookie)),
  );
  assert.ok(
    replacements.every(
      (value) => value.conversation.id === replacement.conversation.id,
    ),
  );
});

test("admin inbox includes guests without fabricated email and normal admin response takes over", async () => {
  useReply("AI reply");
  const thread = await guest();
  await read(await send(thread), 201);
  const list = await read(
    await call("/admin/conversations?limit=50", team.cookie),
    200,
  );
  const entry = list.conversations.find(
    (value: any) => value.id === thread.conversation.id,
  );
  assert.equal(entry.customerName, "Guest");
  assert.equal(entry.customerEmail, null);
  const result = await read(
    await call(
      `/admin/conversations/${thread.conversation.id}/messages`,
      team.cookie,
      { body: "Human reply" },
    ),
    201,
  );
  assert.equal(result.aiEnabled, false);
  const count = model.doGenerateCalls.length;
  const next = await read(await send(thread, "Thanks"), 201);
  assert.equal(next.assistantMessage, null);
  assert.equal(model.doGenerateCalls.length, count);
});

test("claim requires both cookies, preserves IDs/history/provenance, revokes guest reads and writes, and is account-bound idempotent", async () => {
  useReply("Claim reply");
  const thread = await guest();
  const id = thread.conversation.id;
  const sent = await read(await send(thread), 201);
  const path = `/guest/conversations/${id}/claim`;
  await read(await call(path, thread.cookie, {}), 401);
  await read(await call(path, customer.cookie, {}), 404);
  await read(await call(path, `${team.cookie}; ${thread.cookie}`, {}), 403);
  const claims = await Promise.all(
    Array.from({ length: 4 }, () =>
      call(path, `${customer.cookie}; ${thread.cookie}`, {}),
    ),
  );
  for (const response of claims)
    assert.equal((await read(response, 200)).conversationId, id);
  await read(await call(path, `${other.cookie}; ${thread.cookie}`, {}), 404);
  await read(await call(`/guest/conversations/${id}`, thread.cookie), 404);
  await read(await send(thread), 404);
  const owned = await read(
    await call(`/messages/conversations/${id}`, customer.cookie),
    200,
  );
  assert.equal(owned.conversation.customerId, customer.id);
  assert.equal(owned.messages[0].id, sent.message.id);
  assert.equal(owned.messages[0].senderId, null);
  assert.equal(owned.messages[0].senderName, "Guest");
  await read(await call(`/messages/conversations/${id}`, other.cookie), 404);
  assert.equal((await guest(thread.cookie)).messages.length, 0);
  const row = await db
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(row.guest_expires_at, null);
  assert.equal(row.guest_identity_id, null);
});

test("claim races choose one account; expired chats cannot be claimed", async () => {
  const thread = await guest();
  const path = `/guest/conversations/${thread.conversation.id}/claim`;
  const results = await Promise.all(
    [customer, other].map((account) =>
      call(path, `${account.cookie}; ${thread.cookie}`, {}),
    ),
  );
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [200, 404],
  );
  const old = await guest();
  await expired(old);
  assert.equal(
    (
      await read(
        await call(
          `/guest/conversations/${old.conversation.id}/claim`,
          `${customer.cookie}; ${old.cookie}`,
          {},
        ),
        410,
      )
    ).code,
    "guest_expired",
  );
});

test("in-flight guest AI remains guest-scoped after claim; takeover suppresses it and pending replay never duplicates calls", async () => {
  let release!: () => void;
  let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  useReply("unused");
  let calls = 0;
  let capturedPrompt: unknown;
  model.doGenerate = async (options) => {
    calls++;
    capturedPrompt = options.prompt;
    entered();
    await held;
    return {
      content: [{ type: "text", text: "Delayed guest reply" }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    };
  };
  const thread = await guest();
  const id = thread.conversation.id;
  const requestId = randomUUID();
  const pending = send(thread, "First guest question", requestId);
  await enteredPromise;
  const replay = await read(
    await send(thread, "First guest question", requestId),
    201,
  );
  assert.equal(replay.assistantMessage, null);
  await read(
    await call(
      `/guest/conversations/${id}/claim`,
      `${customer.cookie}; ${thread.cookie}`,
      {},
    ),
    200,
  );
  release();
  const completed = await read(await pending, 201);
  assert.equal(completed.assistantMessage.body, "Delayed guest reply");
  const prompt = JSON.stringify(capturedPrompt);
  assert.ok(!prompt.includes("Private package marker"));
  const owned = await read(
    await call(`/messages/conversations/${id}`, customer.cookie),
    200,
  );
  assert.equal(owned.messages.length, 2);
  assert.equal(calls, 1);
});

test("guest takeover invalidates a delayed AI reply through an off/on cycle without extending expiry", async () => {
  let release!: () => void;
  let entered!: () => void;
  let calls = 0;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  useReply("unused");
  model.doGenerate = async () => {
    calls++;
    entered();
    await held;
    return {
      content: [{ type: "text", text: "Must not appear" }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    };
  };
  const thread = await guest();
  const id = thread.conversation.id;
  const pending = send(thread, "Please help");
  await started;
  const reply = await read(
    await call(`/admin/conversations/${id}/messages`, team.cookie, {
      body: "Human taking over",
    }),
    201,
  );
  const expiry = (
    await db
      .selectFrom("conversations")
      .select("guest_expires_at")
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
  ).guest_expires_at!.toISOString();
  await read(
    await app.request(`/v1/admin/conversations/${id}/ai`, {
      method: "PATCH",
      headers: { Cookie: team.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        aiEnabled: true,
        expectedAiVersion: reply.aiVersion,
      }),
    }),
    200,
  );
  release();
  const completed = await read(await pending, 201);
  assert.equal(completed.assistantMessage, null);
  assert.equal(completed.assistantError, null);
  assert.equal(calls, 1);
  const current = await read(
    await call(`/guest/conversations/${id}`, thread.cookie),
    200,
  );
  assert.equal(current.guest.expiresAt, expiry);
  assert.deepEqual(
    current.messages.map((message: any) => message.body),
    ["Please help", "Human taking over"],
  );
});

test("guest database invariants reject ambiguous ownership, over-quota counts and human impersonation; new tables deny direct clients", async () => {
  const thread = await guest();
  const id = thread.conversation.id;
  await assert.rejects(
    pool.query("UPDATE conversations SET customer_id=$1 WHERE id=$2", [
      customer.id,
      id,
    ]),
    /conversations_owner_check/,
  );
  await assert.rejects(
    pool.query(
      "UPDATE conversations SET guest_customer_message_count=6 WHERE id=$1",
      [id],
    ),
    /conversations_guest_count_check/,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id,sender_role,body) VALUES($1,'customer','Anonymous without provenance')",
      [id],
    ),
    /messages_sender_role_matches_id_check/,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id,sender_id,sender_role,guest_origin,body) VALUES($1,$2,'customer',true,'Impersonation')",
      [id, customer.id],
    ),
    /messages_sender_role_matches_id_check/,
  );
  const security = (
    await pool.query(
      "SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('guest_chat_identities','guest_message_requests') AND relnamespace='public'::regnamespace ORDER BY relname",
    )
  ).rows;
  assert.equal(security.length, 2);
  assert.ok(security.every((row) => row.relrowsecurity));
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE c.relname IN ('guest_chat_identities','guest_message_requests') AND acl.grantee=0",
      )
    ).rows[0].count,
    0,
  );
  for (const { rolname } of (
    await pool.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')",
    )
  ).rows) {
    for (const table of ["guest_chat_identities", "guest_message_requests"])
      assert.equal(
        (
          await pool.query(
            "SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS allowed",
            [rolname, table],
          )
        ).rows[0].allowed,
        false,
      );
  }
});

test("validation, foreign cookie isolation, body caps, OpenAPI and Edge route registration match", async () => {
  const thread = await guest();
  const another = await guest();
  await read(
    await call(
      `/guest/conversations/${thread.conversation.id}`,
      another.cookie,
    ),
    404,
  );
  await read(
    await call(`/guest/conversations/${thread.conversation.id}`, ""),
    404,
  );
  await read(
    await call(
      `/guest/conversations/${thread.conversation.id}?cursor=invalid`,
      thread.cookie,
    ),
    400,
  );
  await read(
    await call(
      `/guest/conversations/${thread.conversation.id}/messages`,
      thread.cookie,
      { body: "Hello", requestId: "bad" },
    ),
    400,
  );
  assert.equal(
    (
      await call(
        `/guest/conversations/${thread.conversation.id}/messages`,
        thread.cookie,
        { body: "x".repeat(17000), requestId: randomUUID() },
      )
    ).status,
    413,
  );
  const spec: any = await (await app.request("/openapi.json")).json();
  for (const [path, method] of [
    ["/v1/guest/conversation", "post"],
    ["/v1/guest/conversations/{id}", "get"],
    ["/v1/guest/conversations/{id}/messages", "post"],
    ["/v1/guest/conversations/{id}/claim", "post"],
  ])
    assert.ok(spec.paths[path][method]);
  const { matchRouteFamily } = await import("../src/edge/match-route.js");
  assert.equal(matchRouteFamily("/v1/guest/conversation"), "guest-chat");
  const edge = (await import("../src/edge/server.js")).app;
  const response = await edge.request("/v1/guest/conversation", {
    method: "POST",
    headers: { Cookie: thread.cookie, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(
    (await read(response, 200)).conversation.id,
    thread.conversation.id,
  );
  assert.equal(
    (
      await edge.request(
        `/v1/guest/conversations/${thread.conversation.id}/messages`,
        {
          method: "POST",
          headers: {
            Cookie: thread.cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: "x".repeat(17000),
            requestId: randomUUID(),
          }),
        },
      )
    ).status,
    413,
  );
  await (await import("../src/db/client.js")).db.destroy();
});
