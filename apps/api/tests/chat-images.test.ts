import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import { hashSessionToken } from "../src/utils/session.js";
import { messageImageInterpretationSchema } from "@event-management/contracts/message-images";
const database = `em_chat_images_test_${randomUUID().replaceAll("-", "")}`;
const observation = {
  summary: "A blue floral table arrangement",
  objects: ["table", "flowers"],
  colors: ["blue"],
  styles: ["floral"],
  visibleText: null,
  uncertainty: ["Exact flower species is unclear"],
};
let admin: Pool, pool: Pool;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let customer: { id: string; cookie: string },
  other: { id: string; cookie: string },
  team: { id: string; cookie: string };
let bytes: Uint8Array, alternate: Uint8Array;
let visionCalls = 0;
let textCalls: any[] = [];
let visionFailure = false,
  storageFailure = false;
let afterStorage: (() => Promise<void>) | undefined;
let beforeTextReply: (() => Promise<void>) | undefined;
let beforeVisionReply: (() => Promise<void>) | undefined;
const objects = new Map<string, Uint8Array>();
const originalFetch = globalThis.fetch;
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
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  process.env.DB_NAME = database;
  process.env.AI_GATEWAY_API_KEY = "fixture-key";
  process.env.TEXT_MODEL = "fixture/text";
  process.env.VISION_MODEL = "fixture/vision";
  process.env.SUPABASE_URL = "https://storage.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-key";
  process.env.SUPABASE_STORAGE_BUCKET = "test";
  const { Image } = await import("imagescript");
  bytes = await new Image(1, 1).fill(0x0000ffff).encodePNG();
  alternate = await new Image(1, 1).fill(0xff0000ff).encodePNG();
  const result = (text: string) => ({
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
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
  });
  globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV4({
    languageModels: {
      "fixture/vision": new MockLanguageModelV4({
        doGenerate: async () => {
          visionCalls++;
          await beforeVisionReply?.();
          if (visionFailure) throw new Error("private upstream token marker");
          return result(JSON.stringify(observation));
        },
      }),
      "fixture/text": new MockLanguageModelV4({
        doGenerate: async (options) => {
          textCalls.push(options);
          await beforeTextReply?.();
          return result("I can help with that arrangement.");
        },
      }),
    },
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "storage.invalid", "No external calls in tests");
    const key = decodeURIComponent(
      url.pathname.replace("/storage/v1/object/test/", ""),
    );
    if (init?.method === "POST") {
      if (storageFailure) return new Response("unavailable", { status: 503 });
      objects.set(key, new Uint8Array(init.body as Buffer));
      if (afterStorage) {
        const callback = afterStorage;
        afterStorage = undefined;
        await callback();
      }
      return new Response("{}", { status: 200 });
    }
    if (init?.method === "DELETE") {
      for (const prefix of JSON.parse(String(init.body)).prefixes)
        objects.delete(prefix);
      return new Response("{}", { status: 200 });
    }
    const value = objects.get(key);
    return value
      ? new Response(Buffer.from(value))
      : new Response(null, { status: 404 });
  };
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
});
after(async () => {
  globalThis.fetch = originalFetch;
  delete globalThis.AI_SDK_DEFAULT_PROVIDER;
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
function call(path: string, cookie = "", body?: unknown) {
  return app.request(`/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(body instanceof FormData || body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
}
function form(
  body = "",
  conversationId?: string,
  requestId = randomUUID(),
  images = [bytes],
) {
  const data = new FormData();
  data.set("body", body);
  data.set("requestId", requestId);
  if (conversationId) data.set("conversationId", conversationId);
  for (const image of images)
    data.append(
      "images",
      new File([Buffer.from(image)], "image.png", { type: "image/png" }),
    );
  return data;
}
async function read(response: Response, status = 201) {
  const value: any = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
async function conversation() {
  return (
    await read(await call("/messages/conversations", customer.cookie, {}))
  ).conversation.id as string;
}

test("image-only/caption originals and observations are private; history has metadata from both roles", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("", id),
    ),
  );
  assert.equal(saved.message.body, "");
  assert.equal(saved.message.images.length, 1);
  const image = saved.message.images[0];
  assert.deepEqual(
    messageImageInterpretationSchema.parse(image.interpretation),
    observation,
  );
  assert.match(image.url, /^\/v1\/message-images\//);
  assert.equal("storageKey" in image, false);
  for (const cookie of [customer.cookie, team.cookie]) {
    const response = await app.request(image.url, {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  }
  for (const cookie of ["", other.cookie])
    assert.equal(
      (await app.request(image.url, { headers: { Cookie: cookie } })).status,
      404,
    );
  const reply = await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("A matching option"),
    ),
  );
  assert.equal(reply.message.images.length, 1);
  assert.equal(reply.aiEnabled, false);
  const thread = await read(
    await call(`/messages/conversations/${id}`, customer.cookie),
    200,
  );
  assert.equal(thread.messages.filter((m: any) => m.images.length).length, 2);
  const adminThread = await read(
    await call(`/admin/conversations/${id}`, team.cookie),
    200,
  );
  await read(
    await app.request(`/v1/admin/conversations/${id}/ai`, {
      method: "PATCH",
      headers: { Cookie: team.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        aiEnabled: true,
        expectedAiVersion: adminThread.conversation.aiVersion,
      }),
    }),
    200,
  );
  await read(
    await call("/messages/conversation/messages", customer.cookie, {
      body: "Does this match?",
      conversationId: id,
    }),
  );
  const history = JSON.stringify(textCalls.at(-1).prompt);
  assert.ok(history.includes(observation.summary));
  assert.equal(history.split("Saved image observations").length - 1, 2);
  assert.ok(history.includes("A matching option"));
  assert.equal(history.includes("message-images/"), false);
  assert.equal(history.includes("storage_key"), false);
  assert.equal(history.includes("image/png"), false);
});

test("automatic image tools track each human source, start before vision, and replay without new audit", async () => {
  const id = await conversation();
  let started = 0;
  beforeVisionReply = async () => {
    const rows = await pool.query(
      "SELECT * FROM ai_tool_calls WHERE conversation_id = $1 AND status = 'started'",
      [id],
    );
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].source_message_id, null);
    started++;
  };
  const requestId = randomUUID();
  const sent = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("customer", id, requestId, [bytes, alternate]),
    ),
  );
  beforeVisionReply = undefined;
  assert.equal(started, 2);
  const adminReply = await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("admin"),
    ),
  );
  const offReply = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("AI off", id),
    ),
  );
  const rows = await pool.query(
    "SELECT * FROM ai_tool_calls WHERE conversation_id = $1 ORDER BY started_at",
    [id],
  );
  assert.equal(rows.rowCount, 4);
  for (const [index, row] of rows.rows.entries()) {
    assert.equal(row.status, "succeeded");
    assert.equal(row.tool_name, "interpretMessageImage");
    assert.equal(
      row.source_message_id,
      index < 2
        ? sent.message.id
        : index === 2
          ? adminReply.message.id
          : offReply.message.id,
    );
    assert.equal(row.customer_message_id, null);
    assert.equal(row.assistant_message_id, null);
    assert.equal(row.input.model, "fixture/vision");
    assert.equal(JSON.stringify(row).includes("storage_key"), false);
    assert.equal(JSON.stringify(row).includes(observation.summary), false);
    assert.ok(row.output.observationSha256);
    assert.ok(row.completed_at);
  }
  assert.equal(rows.rows[0].turn_id, rows.rows[1].turn_id);
  const calls = visionCalls;
  await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("customer", id, requestId, [bytes, alternate]),
    ),
  );
  assert.equal(visionCalls, calls);
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM ai_tool_calls WHERE conversation_id = $1",
        [id],
      )
    ).rowCount,
    4,
  );
  const guestResponse = await call("/guest/conversation", "", {});
  const guest = await read(guestResponse, 200);
  const cookie = guestResponse.headers.get("set-cookie")!.split(";")[0];
  const guestMessage = await read(
    await call(
      `/guest/conversations/${guest.conversation.id}/messages`,
      cookie,
      form(),
    ),
  );
  const guestRows = await pool.query(
    "SELECT * FROM ai_tool_calls WHERE conversation_id = $1",
    [guest.conversation.id],
  );
  assert.equal(guestRows.rowCount, 1);
  assert.equal(guestRows.rows[0].source_message_id, guestMessage.message.id);
});

test("image audit failures are sanitized and tracking or linking failures prevent the message", async () => {
  const id = await conversation();
  visionFailure = true;
  await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("failure", id),
    ),
    502,
  );
  visionFailure = false;
  const failed = await pool.query(
    "SELECT * FROM ai_tool_calls WHERE conversation_id = $1",
    [id],
  );
  assert.equal(failed.rowCount, 1);
  assert.equal(failed.rows[0].status, "failed");
  assert.equal(failed.rows[0].source_message_id, null);
  assert.equal(failed.rows[0].error_code, "vision_unavailable");
  assert.equal(JSON.stringify(failed.rows).includes("private upstream"), false);

  await pool.query(
    "CREATE FUNCTION test_reject_image_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tool_name = 'interpretMessageImage' THEN RAISE EXCEPTION 'test tracking failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER test_reject_image_audit BEFORE INSERT ON ai_tool_calls FOR EACH ROW EXECUTE FUNCTION test_reject_image_audit()",
  );
  const before = visionCalls,
    blockedId = randomUUID();
  try {
    await read(
      await call(
        "/messages/conversation/messages",
        customer.cookie,
        form("blocked", id, blockedId),
      ),
      502,
    );
    assert.equal(visionCalls, before);
    assert.equal(
      (await pool.query("SELECT id FROM messages WHERE id = $1", [blockedId]))
        .rowCount,
      0,
    );
  } finally {
    await pool.query("DROP TRIGGER test_reject_image_audit ON ai_tool_calls");
    await pool.query("DROP FUNCTION test_reject_image_audit()");
  }

  await pool.query(
    "CREATE FUNCTION test_reject_image_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tool_name = 'interpretMessageImage' AND NEW.status = 'succeeded' THEN RAISE EXCEPTION 'test completion failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER test_reject_image_completion BEFORE UPDATE ON ai_tool_calls FOR EACH ROW EXECUTE FUNCTION test_reject_image_completion()",
  );
  const completionId = randomUUID(),
    beforeCompletion = visionCalls;
  try {
    await read(
      await call(
        "/messages/conversation/messages",
        customer.cookie,
        form("completion blocked", id, completionId),
      ),
      502,
    );
    assert.equal(visionCalls, beforeCompletion + 1);
    assert.equal(
      (
        await pool.query("SELECT id FROM messages WHERE id = $1", [
          completionId,
        ])
      ).rowCount,
      0,
    );
    const started = await pool.query(
      "SELECT * FROM ai_tool_calls WHERE conversation_id = $1 AND status = 'started'",
      [id],
    );
    assert.equal(started.rowCount, 1);
    assert.equal(started.rows[0].source_message_id, null);
  } finally {
    await pool.query(
      "DROP TRIGGER test_reject_image_completion ON ai_tool_calls",
    );
    await pool.query("DROP FUNCTION test_reject_image_completion()");
  }

  const rollbackId = randomUUID(),
    previousObjects = objects.size;
  afterStorage = async () => {
    await pool.query(
      "DELETE FROM ai_tool_calls WHERE conversation_id = $1 AND status = 'succeeded' AND source_message_id IS NULL",
      [id],
    );
  };
  const response = await call(
    "/messages/conversation/messages",
    customer.cookie,
    form("rollback", id, rollbackId),
  );
  assert.equal(response.status, 500);
  assert.equal(
    (await pool.query("SELECT id FROM messages WHERE id = $1", [rollbackId]))
      .rowCount,
    0,
  );
  assert.equal(objects.size, previousObjects);
});

test("missing vision configuration records a failed tool call", async () => {
  const id = await conversation();
  const model = process.env.VISION_MODEL;
  delete process.env.VISION_MODEL;
  try {
    const before = visionCalls;
    await read(
      await call(
        "/messages/conversation/messages",
        customer.cookie,
        form("missing model", id),
      ),
      502,
    );
    assert.equal(visionCalls, before);
    const rows = await pool.query(
      "SELECT * FROM ai_tool_calls WHERE conversation_id = $1",
      [id],
    );
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].status, "failed");
    assert.equal(rows.rows[0].input.model, null);
    assert.equal(rows.rows[0].source_message_id, null);
  } finally {
    process.env.VISION_MODEL = model;
  }
});

test("database enforces image and assistant tool source branches on insert and update", async () => {
  const first = await conversation(),
    second = await conversation();
  const source = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("image", first),
    ),
  );
  const otherMessage = await read(
    await call("/messages/conversation/messages", customer.cookie, {
      body: "other",
      conversationId: second,
    }),
  );
  const imageId = source.message.images[0].id;
  const row = (
    await pool.query("SELECT * FROM ai_tool_calls WHERE tool_call_id = $1", [
      imageId,
    ])
  ).rows[0];
  await assert.rejects(
    pool.query(
      "UPDATE ai_tool_calls SET source_message_id = $1 WHERE id = $2",
      [otherMessage.message.id, row.id],
    ),
    /same conversation/,
  );
  await assert.rejects(
    pool.query(
      "UPDATE ai_tool_calls SET tool_name = 'otherTool' WHERE id = $1",
      [row.id],
    ),
    /cannot have an image source/,
  );
  await assert.rejects(
    pool.query(
      "UPDATE ai_tool_calls SET customer_message_id = $1 WHERE id = $2",
      [source.message.id, row.id],
    ),
    /requires only a conversation/,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO ai_tool_calls (turn_id, tool_call_id, tool_name, input) VALUES ($1, 'bad', 'otherTool', '{}')",
      [randomUUID()],
    ),
    /requires a customer message/,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO ai_tool_calls (turn_id, tool_call_id, tool_name, conversation_id, source_message_id, input) VALUES ($1, 'bad', 'interpretMessageImage', $2, $3, '{}')",
      [randomUUID(), first, otherMessage.message.id],
    ),
    /same conversation/,
  );
});
test("replay compares hashes/order without vision; concurrent retries save once", async () => {
  const id = await conversation(),
    requestId = randomUUID();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("caption", id, requestId, [bytes, alternate]),
    ),
  );
  const calls = visionCalls;
  const replay = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("caption", id, requestId, [bytes, alternate]),
    ),
  );
  assert.deepEqual(replay.message, saved.message);
  assert.equal(visionCalls, calls);
  await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("caption", id, requestId, [alternate, bytes]),
    ),
    409,
  );
  await read(
    await call(
      "/messages/conversation/messages",
      other.cookie,
      form("caption", id, requestId),
    ),
    404,
  );
  assert.equal(visionCalls, calls);
  const concurrentId = randomUUID(),
    start = visionCalls;
  const results = await Promise.all([
    call(
      "/messages/conversation/messages",
      customer.cookie,
      form("parallel", id, concurrentId),
    ),
    call(
      "/messages/conversation/messages",
      customer.cookie,
      form("parallel", id, concurrentId),
    ),
  ]);
  assert.equal(
    (await read(results[0])).message.id,
    (await read(results[1])).message.id,
  );
  assert.equal(visionCalls, start + 1);
});
test("vision/storage/commit failures save no message or metadata and clean originals", async () => {
  for (const failure of ["vision", "storage", "commit"]) {
    const id = await conversation(),
      requestId = randomUUID(),
      size = objects.size;
    visionFailure = failure === "vision";
    storageFailure = failure === "storage";
    if (failure === "commit")
      afterStorage = async () => {
        await db.deleteFrom("conversations").where("id", "=", id).execute();
      };
    const result = await read(
      await call(
        "/messages/conversation/messages",
        customer.cookie,
        form("failure", id, requestId),
      ),
      failure === "commit" ? 404 : 502,
    );
    assert.equal(JSON.stringify(result).includes("private upstream"), false);
    assert.equal(
      (
        await db
          .selectFrom("messages")
          .select("id")
          .where("id", "=", requestId)
          .execute()
      ).length,
      0,
    );
    assert.equal(objects.size, size);
    visionFailure = false;
    storageFailure = false;
  }
});
test("invalid images and denied ownership fail before vision", async () => {
  const id = await conversation(),
    calls = visionCalls;
  await read(
    await call("/messages/conversation/messages", other.cookie, form("", id)),
    404,
  );
  await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("", id, randomUUID(), [bytes, bytes, bytes, bytes, bytes]),
    ),
    400,
  );
  const forged = form("", id, randomUUID(), []);
  forged.append(
    "images",
    new File(["garbage"], "image.png", { type: "image/png" }),
  );
  await read(
    await call("/messages/conversation/messages", customer.cookie, forged),
    400,
  );
  await read(
    await call("/messages/conversation/messages", customer.cookie, {
      body: "",
      conversationId: id,
    }),
    400,
  );
  assert.equal(visionCalls, calls);
});
test("guest budget/replay, global request conflicts, claim and expiry protect images", async () => {
  const response = await call("/guest/conversation", "", {}),
    guest = await read(response, 200),
    cookie = response.headers.get("set-cookie")!.split(";")[0],
    id = guest.conversation.id,
    requestId = randomUUID(),
    path = `/guest/conversations/${id}/messages`;
  const first = await read(
      await call(path, cookie, form("", undefined, requestId)),
    ),
    calls = visionCalls;
  await read(await call(path, cookie, form("", undefined, requestId)));
  assert.equal(visionCalls, calls);
  assert.equal(
    (
      await app.request(first.message.images[0].url, {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  const stolen = randomUUID();
  await read(
    await call("/messages/conversation/messages", customer.cookie, {
      body: "owner",
      requestId: stolen,
    }),
  );
  const beforeConflict = visionCalls;
  await read(await call(path, cookie, form("", undefined, stolen)), 409);
  assert.equal(visionCalls, beforeConflict);
  for (let index = 0; index < 4; index++)
    await read(
      await call(path, cookie, {
        body: `guest ${index}`,
        requestId: randomUUID(),
      }),
    );
  const exhausted = visionCalls;
  await read(await call(path, cookie, form()), 409);
  assert.equal(visionCalls, exhausted);
  await read(
    await call(
      `/guest/conversations/${id}/claim`,
      `${cookie}; ${customer.cookie}`,
      {},
    ),
    200,
  );
  assert.equal(
    (
      await app.request(first.message.images[0].url, {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await app.request(first.message.images[0].url, {
        headers: { Cookie: customer.cookie },
      })
    ).status,
    200,
  );
  const expiry = await call("/guest/conversation", "", {}),
    expired = await read(expiry, 200),
    expiredCookie = expiry.headers.get("set-cookie")!.split(";")[0];
  const message = await read(
    await call(
      `/guest/conversations/${expired.conversation.id}/messages`,
      expiredCookie,
      form(),
    ),
  );
  await db
    .updateTable("conversations")
    .set({ guest_expires_at: new Date(0) })
    .where("id", "=", expired.conversation.id)
    .execute();
  assert.equal(
    (
      await app.request(message.message.images[0].url, {
        headers: { Cookie: expiredCookie },
      })
    ).status,
    404,
  );
});

test("closed admin targets reject before vision; takeover during image processing suppresses AI", async () => {
  const id = await conversation();
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("id", "=", id)
    .execute();
  const beforeVision = visionCalls;
  await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("closed"),
    ),
    409,
  );
  assert.equal(visionCalls, beforeVision);
  await db
    .updateTable("conversations")
    .set({ status: "active", closed_at: null })
    .where("id", "=", id)
    .execute();
  const beforeText = textCalls.length;
  afterStorage = async () => {
    await read(
      await call(`/admin/conversations/${id}/messages`, team.cookie, {
        body: "A human is handling this",
      }),
    );
  };
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("image after takeover", id),
    ),
  );
  assert.equal(saved.assistantMessage, null);
  assert.equal(textCalls.length, beforeText);
  const current = await db
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(current.ai_enabled, false);
  const calls = visionCalls;
  const adminId = randomUUID();
  const sent = await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("retry admin", undefined, adminId),
    ),
  );
  const replay = await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("retry admin", undefined, adminId),
    ),
  );
  assert.deepEqual(replay.message, sent.message);
  assert.equal(visionCalls, calls + 1);
  await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("changed admin", undefined, adminId),
    ),
    409,
  );
});

test("new message-images rows have RLS and reject invalid storage metadata", async () => {
  const rls = await pool.query(
    "SELECT relrowsecurity FROM pg_class WHERE oid = 'message_images'::regclass",
  );
  assert.equal(rls.rows[0].relrowsecurity, true);
  const grants = await pool.query(
    "SELECT grantee FROM information_schema.role_table_grants WHERE table_name = 'message_images' AND grantee IN ('PUBLIC','anon','authenticated')",
  );
  assert.equal(grants.rowCount, 0);
  const id = await conversation();
  const message = await read(
    await call("/messages/conversation/messages", customer.cookie, {
      body: "Metadata constraint",
      conversationId: id,
    }),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO message_images (message_id, position, storage_key, mime_type, byte_size, content_hash, interpretation) VALUES ($1, 4, 'invalid', 'image/png', 1, $2, '{}'::jsonb)",
      [message.message.id, "a".repeat(64)],
    ),
    /message_images/,
  );
});

test(
  "image replay returns while the first assistant reply is still pending",
  { timeout: 10_000 },
  async () => {
    for (const guestMode of [false, true]) {
      let path: string, cookie: string, id: string | undefined;
      if (guestMode) {
        const bootstrap = await call("/guest/conversation", "", {});
        const value = await read(bootstrap, 200);
        path = `/guest/conversations/${value.conversation.id}/messages`;
        cookie = bootstrap.headers.get("set-cookie")!.split(";")[0];
      } else {
        path = "/messages/conversation/messages";
        cookie = customer.cookie;
        id = await conversation();
      }
      let started!: () => void, release!: () => void;
      const generating = new Promise<void>((resolve) => {
        started = resolve;
      });
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      beforeTextReply = async () => {
        started();
        await blocked;
      };
      const requestId = randomUUID();
      const first = call(path, cookie, form("pending image", id, requestId));
      try {
        await generating;
        const replay = await read(
          await call(path, cookie, form("pending image", id, requestId)),
        );
        assert.equal(replay.assistantMessage, null);
        assert.equal(replay.message.id, requestId);
      } finally {
        release();
        beforeTextReply = undefined;
        await read(await first);
      }
    }
  },
);
