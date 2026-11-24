import "dotenv/config";
import { assertImageMessageJobLeaseData } from "../src/data/messages/message-processing.js";
import { runOneBackgroundJob } from "../src/services/background-jobs/run-one-background-job.js";
import { claimJobData } from "../src/data/background-jobs/claim-job.js";
import { backgroundJobPolicies } from "../src/services/background-jobs/job-definitions.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import { hashSessionToken } from "../src/utils/session.js";
import { messageImageInterpretationSchema } from "@event-management/contracts/message-images";
import { setTestConfig, testDatabaseUrl } from "./helpers/set-test-config.js";

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

  setTestConfig({ SUPABASE_DB_URL: testDatabaseUrl(database) });
  setTestConfig({ AI_GATEWAY_API_KEY: "fixture-key" });
  setTestConfig({ TEXT_MODEL: "fixture/text" });
  setTestConfig({ VISION_MODEL: "fixture/vision" });
  setTestConfig({ SUPABASE_URL: "https://storage.invalid" });
  setTestConfig({ SUPABASE_SERVICE_ROLE_KEY: "fixture-key" });
  setTestConfig({ SUPABASE_STORAGE_BUCKET: "test" });
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

          return result(
            JSON.stringify({
              message: "I can help with that arrangement.",
              suggested_replies: ["Can you show me a similar arrangement?"],
            }),
          );
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

const signal = () => new AbortController().signal;

const run = () => runOneBackgroundJob(db, { signal: signal() });

async function thread(id: string) {
  return read(
    await call(`/messages/conversations/${id}`, customer.cookie),
    200,
  );
}

async function current(id: string, messageId: string) {
  return (await thread(id)).messages.find((m: any) => m.id === messageId);
}

async function due() {
  await pool.query(
    "UPDATE background_jobs SET available_at = clock_timestamp() - interval '1 second' WHERE status = 'pending'",
  );
}

async function lastAttempt(messageId: string) {
  await pool.query(
    "UPDATE background_jobs SET attempts = 3 WHERE type = 'process_image_message' AND dedupe_key = $1",
    [messageId],
  );
}

async function retry(id: string, messageId: string, cookie = customer.cookie) {
  return call(
    `/messages/conversations/${id}/messages/${messageId}/retry`,
    cookie,
    {},
  );
}

function gate() {
  let release!: () => void, entered!: () => void;

  const waiting = new Promise<void>((r) => {
    release = r;
  });

  const started = new Promise<void>((r) => {
    entered = r;
  });

  return {
    release,
    started,
    wait: async () => {
      entered();
      await waiting;
    },
  };
}

test("send commits queued metadata and private bytes without vision; worker saves audited observations and scoped reply", async () => {
  const id = await conversation(),
    before = visionCalls;
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("", id),
    ),
  );
  assert.equal(visionCalls, before);
  assert.equal(saved.assistantMessage, null);
  assert.equal(saved.message.processing.status, "queued");
  assert.equal(saved.message.processing.replyPending, true);
  const image = saved.message.images[0];
  assert.equal(image.interpretation, null);
  assert.equal(
    (await app.request(image.url, { headers: { Cookie: customer.cookie } }))
      .status,
    404,
  );
  assert.equal(await run(), true);
  const finished = await current(id, saved.message.id);
  assert.equal(finished.processing.status, "completed");
  assert.equal(finished.processing.replyPending, false);

  const reply = (await thread(id)).messages.find(
    (message: any) => message.replyToMessageId === saved.message.id,
  );

  assert.equal(reply?.senderRole, "assistant");
  assert.equal(finished.replyToMessageId, null);
  assert.deepEqual(
    messageImageInterpretationSchema.parse(finished.images[0].interpretation),
    observation,
  );

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

  const audit = (
    await pool.query(
      "SELECT * FROM ai_tool_calls WHERE source_message_id = $1",
      [saved.message.id],
    )
  ).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].status, "succeeded");
  assert.equal(audit[0].customer_message_id, null);
  assert.equal(audit[0].assistant_message_id, null);
  assert.equal(audit[0].input.model, "fixture/vision");
  assert.ok(audit[0].output.observationSha256);
  assert.equal(JSON.stringify(audit).includes(observation.summary), false);
  assert.equal(JSON.stringify(audit).includes("storage_key"), false);
  const history = JSON.stringify(textCalls.at(-1).prompt);
  assert.ok(history.includes(observation.summary));
  const savedReply = (
    await pool.query(
      "SELECT suggested_replies FROM messages WHERE reply_to_message_id = $1",
      [saved.message.id],
    )
  ).rows[0];
  assert.deepEqual(savedReply.suggested_replies, [
    "Can you show me a similar arrangement?",
  ]);
  assert.equal(history.includes("message-images/"), false);
  assert.equal(history.includes("storage_key"), false);
});

test("reply pending is conversation-wide and follows job, reply, and AI eligibility", async () => {
  const id = await conversation();
  const first = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("first", id),
    ),
  );
  const second = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("second", id),
    ),
  );
  assert.equal(first.message.processing.replyPending, true);
  assert.equal((await thread(id)).conversation.aiReplyPending, true);
  // The first job remains visible to the aggregate even when it is outside the page.
  await pool.query(
    "UPDATE background_jobs SET status = 'failed', completed_at = clock_timestamp() WHERE dedupe_key = $1",
    [second.message.id],
  );
  const page = await read(
    await call(`/messages/conversations/${id}?limit=1`, customer.cookie),
    200,
  );
  assert.equal(
    page.messages.some((message: any) => message.id === first.message.id),
    false,
  );
  assert.equal(page.conversation.aiReplyPending, true);
  const both = await thread(id);
  assert.equal(
    both.messages.find((message: any) => message.id === first.message.id)
      .processing.replyPending,
    true,
  );
  assert.equal(
    both.messages.find((message: any) => message.id === second.message.id)
      .processing.replyPending,
    false,
  );
  await pool.query(
    "UPDATE background_jobs SET status = 'running', lease_token = $2, lease_expires_at = clock_timestamp() + interval '1 minute' WHERE dedupe_key = $1",
    [first.message.id, randomUUID()],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, true);
  await pool.query(
    "UPDATE background_jobs SET status = 'pending', lease_token = null, lease_expires_at = null, available_at = clock_timestamp() + interval '1 hour' WHERE dedupe_key = $1",
    [first.message.id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, true);

  await pool.query(
    "UPDATE conversations SET ai_enabled = false, ai_version = ai_version + 1 WHERE id = $1",
    [id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, false);
  await pool.query(
    "UPDATE conversations SET ai_enabled = true, ai_version = ai_version + 1 WHERE id = $1",
    [id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, false);
  await pool.query(
    "UPDATE background_jobs SET payload = jsonb_set(payload, '{aiVersion}', to_jsonb(2)) WHERE dedupe_key = $1",
    [first.message.id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, true);
  await pool.query(
    "UPDATE background_jobs SET payload = jsonb_set(payload, '{suppressReply}', 'true') WHERE dedupe_key = $1",
    [first.message.id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, false);
  await pool.query(
    "UPDATE background_jobs SET payload = payload - 'suppressReply' WHERE dedupe_key = $1",
    [first.message.id],
  );
  await pool.query(
    "INSERT INTO messages (conversation_id, sender_role, body, reply_to_message_id) VALUES ($1, 'assistant', 'reply', $2)",
    [id, second.message.id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, false);
  await pool.query("DELETE FROM messages WHERE reply_to_message_id = $1", [
    second.message.id,
  ]);
  await pool.query(
    "INSERT INTO messages (conversation_id, sender_role, body, reply_to_message_id) VALUES ($1, 'assistant', 'reply', $2)",
    [id, first.message.id],
  );
  assert.equal((await thread(id)).conversation.aiReplyPending, false);
  assert.equal(
    (await current(id, first.message.id)).processing.replyPending,
    false,
  );
  await pool.query(
    "UPDATE background_jobs SET status = 'completed', completed_at = clock_timestamp() WHERE dedupe_key = $1",
    [first.message.id],
  );
});

test("expired guest conversations do not report pending AI replies", async () => {
  const response = await call("/guest/conversation", "", {});
  const guest = await read(response, 200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const id = guest.conversation.id;
  const sent = await read(
    await call(`/guest/conversations/${id}/messages`, cookie, form("guest")),
  );
  assert.equal(sent.message.processing.replyPending, true);
  const { findConversationData } =
    await import("../src/data/messages/find-conversation.js");
  assert.equal((await findConversationData(db, id))?.ai_reply_pending, true);
  await pool.query(
    "UPDATE messages SET created_at = clock_timestamp() - interval '25 hours' WHERE conversation_id = $1",
    [id],
  );
  assert.equal((await findConversationData(db, id))?.ai_reply_pending, false);
  await pool.query(
    "UPDATE background_jobs SET status = 'completed', completed_at = clock_timestamp() WHERE dedupe_key = $1",
    [sent.message.id],
  );
});

test("text follow-up waits for the earlier image job before replying", async () => {
  const id = await conversation(),
    held = gate(),
    before = textCalls.length;
  const first = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("first-image", id),
    ),
  );
  beforeVisionReply = held.wait;
  const running = run();
  await held.started;
  const pending = call("/messages/conversation/messages", customer.cookie, {
    body: "rapid-followup",
    conversationId: id,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(textCalls.length, before);
  beforeVisionReply = undefined;
  held.release();
  await running;
  const second = await read(await pending);
  assert.equal(second.message.processing, null);
  assert.ok(second.assistantMessage);
  assert.equal(textCalls.length, before + 2);
  assert.equal(
    JSON.stringify(textCalls.at(-2).prompt).includes("rapid-followup"),
    false,
  );
  const history = JSON.stringify(textCalls.at(-1).prompt);
  assert.ok(history.includes(observation.summary));
  assert.ok(history.includes("I can help with that arrangement."));
  assert.equal(
    (await current(id, first.message.id)).processing.status,
    "completed",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM background_jobs WHERE dedupe_key = $1",
        [second.message.id],
      )
    ).rows[0].count,
    0,
  );
});

test("admin and AI-disabled images are interpreted automatically without triggering a text reply", async () => {
  const id = await conversation(),
    before = textCalls.length;
  const adminSent = await read(
    await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      form("admin-image", undefined, randomUUID(), [bytes, alternate]),
    ),
  );
  const customerSent = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("AI-off", id),
    ),
  );
  assert.equal(adminSent.aiEnabled, false);
  assert.equal(adminSent.message.processing.replyPending, false);
  assert.equal(customerSent.message.processing.replyPending, false);
  assert.equal((await thread(id)).conversation.aiReplyPending, false);
  await run();
  await run();
  assert.equal(textCalls.length, before);
  assert.equal((await current(id, adminSent.message.id)).images.length, 2);
  assert.equal(
    (await current(id, customerSent.message.id)).processing.status,
    "completed",
  );
});

test("message, image metadata, guest quota reservation and durable job roll back together", async () => {
  await pool.query(
    "CREATE FUNCTION test_reject_message_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'process_image_message' THEN RAISE EXCEPTION 'fixture enqueue rejection'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER test_reject_message_job BEFORE INSERT ON background_jobs FOR EACH ROW EXECUTE FUNCTION test_reject_message_job()",
  );
  const id = await conversation(),
    requestId = randomUUID(),
    count = objects.size;
  const bootstrap = await call("/guest/conversation", "", {}),
    guest = await read(bootstrap, 200),
    cookie = bootstrap.headers.get("set-cookie")!.split(";")[0];

  try {
    await read(
      await call(
        "/messages/conversation/messages",
        customer.cookie,
        form("rollback", id, requestId),
      ),
      500,
    );
    assert.equal(
      (await pool.query("SELECT id FROM messages WHERE id = $1", [requestId]))
        .rowCount,
      0,
    );
    assert.equal(objects.size, count);
    const guestId = randomUUID();
    await read(
      await call(
        `/guest/conversations/${guest.conversation.id}/messages`,
        cookie,
        form("rollback", undefined, guestId),
      ),
      500,
    );
    const row = (
      await pool.query(
        "SELECT guest_customer_message_count FROM conversations WHERE id = $1",
        [guest.conversation.id],
      )
    ).rows[0];
    assert.equal(row.guest_customer_message_count, 0);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM guest_message_requests WHERE request_id = $1",
          [guestId],
        )
      ).rowCount,
      0,
    );
  } finally {
    await pool.query("DROP TRIGGER test_reject_message_job ON background_jobs");
    await pool.query("DROP FUNCTION test_reject_message_job()");
  }
});

test("concurrent request replay creates exactly one message, job and ordered image set", async () => {
  const id = await conversation(),
    requestId = randomUUID(),
    before = visionCalls;

  const results = await Promise.all(
    [1, 2].map(() =>
      call(
        "/messages/conversation/messages",
        customer.cookie,
        form("same", id, requestId, [bytes, alternate]),
      ),
    ),
  );

  for (const response of results) await read(response);

  assert.equal(visionCalls, before);
  assert.equal(
    (
      await pool.query(
        "SELECT * FROM background_jobs WHERE type = 'process_image_message' AND dedupe_key = $1",
        [requestId],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await pool.query("SELECT * FROM message_images WHERE message_id = $1", [
        requestId,
      ])
    ).rowCount,
    2,
  );
  await run();
  assert.equal(visionCalls, before + 2);
  await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("same", id, requestId, [bytes, alternate]),
    ),
  );
  assert.equal(visionCalls, before + 2);
  await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("conflict", id, requestId),
    ),
    409,
  );
});

test("vision failure is durable, safely coded and retried from saved upload only by an authorized viewer", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("retry", id),
    ),
  );
  await lastAttempt(saved.message.id);
  visionFailure = true;
  await run();
  visionFailure = false;
  const failed = await current(id, saved.message.id);
  assert.deepEqual(failed.processing, {
    status: "failed",
    errorCode: "vision_unavailable",
    canRetry: true,
    replyPending: false,
  });
  assert.equal(failed.images[0].interpretation, null);
  assert.equal(JSON.stringify(failed).includes("private upstream"), false);
  await read(await retry(id, saved.message.id, other.cookie), 404);
  const count = objects.size;
  const retried = await read(await retry(id, saved.message.id), 200);
  assert.equal(retried.message.processing.status, "queued");
  assert.equal(retried.message.processing.replyPending, true);
  await run();
  assert.equal(objects.size, count);
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "completed",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT * FROM messages WHERE reply_to_message_id = $1",
        [saved.message.id],
      )
    ).rowCount,
    1,
  );
});

test("bounded API checks accept a signature but worker rejects invalid decode, blocks original, and later turn sees unavailable marker", async () => {
  const id = await conversation();
  const corrupt = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("invalid", id, randomUUID(), [corrupt]),
    ),
  );
  await run();
  const failed = await current(id, saved.message.id);
  assert.deepEqual(failed.processing, {
    status: "failed",
    errorCode: "invalid_image",
    canRetry: false,
    replyPending: false,
  });
  assert.equal(
    (
      await app.request(failed.images[0].url, {
        headers: { Cookie: customer.cookie },
      })
    ).status,
    404,
  );
  await read(await retry(id, saved.message.id), 409);
  const next = await read(
    await call("/messages/conversation/messages", customer.cookie, {
      conversationId: id,
      body: "later question",
    }),
  );
  assert.equal(next.message.processing, null);
  assert.ok(next.assistantMessage);
  assert.ok(
    JSON.stringify(textCalls.at(-1).prompt).includes(
      "interpretation_unavailable",
    ),
  );
});

test("pending retry backoff blocks later turns until its predecessor settles", async () => {
  const id = await conversation();
  const first = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("first", id),
    ),
  );
  const followup = await read(
    await call("/messages/conversation/messages", customer.cookie, {
      conversationId: id,
      body: "followup",
    }),
  );
  assert.equal(followup.message.processing, null);
  assert.match(followup.assistantError, /message was saved/);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM background_jobs WHERE dedupe_key = $1",
        [followup.message.id],
      )
    ).rows[0].count,
    0,
  );
  visionFailure = true;
  await run();
  visionFailure = false;
  assert.equal(
    (await current(id, first.message.id)).processing.status,
    "queued",
  );
  assert.equal(await run(), false);
  await due();
  await run();
  await run();
});

test("lease expiry fences a stale vision callback while a new worker recovers the saved job", async () => {
  const id = await conversation(),
    held = gate();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("expiry", id),
    ),
  );
  beforeVisionReply = held.wait;
  const oldWorker = run();
  await held.started;
  await pool.query(
    "UPDATE background_jobs SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE type = 'process_image_message' AND dedupe_key = $1",
    [saved.message.id],
  );
  assert.equal(
    await claimJobData(db, 60_000, backgroundJobPolicies),
    undefined,
  );
  await due();
  beforeVisionReply = undefined;
  await run();
  held.release();
  await oldWorker;
  const final = await current(id, saved.message.id);
  assert.equal(final.processing.status, "completed");
  assert.equal(
    (
      await pool.query(
        "SELECT * FROM messages WHERE reply_to_message_id = $1",
        [saved.message.id],
      )
    ).rowCount,
    1,
  );
  const rows = (
    await pool.query(
      "SELECT status FROM ai_tool_calls WHERE source_message_id = $1",
      [saved.message.id],
    )
  ).rows;
  assert.deepEqual(rows.map((r) => r.status).sort(), ["started", "succeeded"]);
});

test("takeover off/on during interpretation saves observations but suppresses the captured AI version", async () => {
  const id = await conversation(),
    held = gate(),
    before = textCalls.length;
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("takeover", id),
    ),
  );
  beforeVisionReply = held.wait;
  const running = run();
  await held.started;
  await read(
    await call(`/admin/conversations/${id}/messages`, team.cookie, {
      body: "human takeover",
    }),
  );
  const state = await read(
    await call(`/admin/conversations/${id}`, team.cookie),
    200,
  );
  await read(
    await app.request(`/v1/admin/conversations/${id}/ai`, {
      method: "PATCH",
      headers: { Cookie: team.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        aiEnabled: true,
        expectedAiVersion: state.conversation.aiVersion,
      }),
    }),
    200,
  );
  beforeVisionReply = undefined;
  held.release();
  await running;
  const final = await current(id, saved.message.id);
  assert.equal(final.processing.status, "suppressed");
  assert.deepEqual(final.images[0].interpretation, observation);
  assert.equal(textCalls.length, before);
});

test("retry after a later reply repairs images without appending an obsolete automatic answer", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("old", id),
    ),
  );
  await lastAttempt(saved.message.id);
  visionFailure = true;
  await run();
  visionFailure = false;
  await read(
    await call("/messages/conversation/messages", customer.cookie, {
      conversationId: id,
      body: "new",
    }),
  );
  await run();
  const before = textCalls.length;
  assert.equal(
    (await read(await retry(id, saved.message.id), 200)).message.processing
      .replyPending,
    false,
  );
  await run();
  assert.deepEqual(
    (await current(id, saved.message.id)).images[0].interpretation,
    observation,
  );
  assert.equal(textCalls.length, before);
  assert.equal(
    (
      await pool.query(
        "SELECT * FROM messages WHERE reply_to_message_id = $1",
        [saved.message.id],
      )
    ).rowCount,
    0,
  );
});

test("a crash after reply commit recovers without another model call or duplicate normal/handoff reply", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("crash", id),
    ),
  );
  await run();
  const before = textCalls.length;
  await pool.query(
    "UPDATE background_jobs SET status = 'pending', completed_at = NULL, available_at = clock_timestamp() WHERE type = 'process_image_message' AND dedupe_key = $1",
    [saved.message.id],
  );
  await run();
  assert.equal(textCalls.length, before);
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "completed",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT * FROM messages WHERE reply_to_message_id = $1",
        [saved.message.id],
      )
    ).rowCount,
    1,
  );
});

test("guest images reserve one allowance and claim revokes reads/retries while preserving worker guest capability", async () => {
  const response = await call("/guest/conversation", "", {}),
    guest = await read(response, 200),
    cookie = response.headers.get("set-cookie")!.split(";")[0];
  const id = guest.conversation.id;
  const saved = await read(
    await call(
      `/guest/conversations/${id}/messages`,
      cookie,
      form("guest image"),
    ),
  );
  assert.equal(saved.guest.remainingMessages, 4);
  const held = gate();
  beforeVisionReply = held.wait;
  const running = run();
  await held.started;
  await read(
    await call(
      `/guest/conversations/${id}/claim`,
      `${customer.cookie}; ${cookie}`,
      {},
    ),
    200,
  );
  beforeVisionReply = undefined;
  held.release();
  await running;
  const final = await current(id, saved.message.id);
  assert.equal(final.processing.status, "completed");
  assert.equal(
    (await app.request(final.images[0].url, { headers: { Cookie: cookie } }))
      .status,
    404,
  );
  await read(
    await call(
      `/guest/conversations/${id}/messages/${saved.message.id}/retry`,
      cookie,
      {},
    ),
    404,
  );
  assert.equal(
    JSON.stringify(textCalls.at(-1).tools).includes("getMyPackage"),
    false,
  );
});

test("cancellation fences a model that ignores AbortSignal and a recovered job commits only one reply", async () => {
  const id = await conversation(),
    held = gate();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("cancel text", id),
    ),
  );
  beforeTextReply = held.wait;
  const controller = new AbortController();
  const abandoned = runOneBackgroundJob(db, { signal: controller.signal });
  await held.started;
  controller.abort();
  await abandoned;
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "queued",
  );
  await due();
  beforeTextReply = undefined;
  await run();
  held.release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    (
      await pool.query(
        "SELECT * FROM messages WHERE reply_to_message_id = $1",
        [saved.message.id],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "completed",
  );
});

test("reply database identity rejects duplicate normal or handoff acknowledgement and cross-thread trigger", async () => {
  const id = await conversation(),
    otherId = await conversation();
  const saved = await read(
    await call("/messages/conversation/messages", customer.cookie, {
      conversationId: id,
      body: "one reply",
    }),
  );
  await run();
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id,sender_role,body,reply_to_message_id) VALUES ($1,'assistant','handoff duplicate',$2)",
      [id, saved.message.id],
    ),
    (error: any) => error.code === "23505",
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id,sender_role,body,reply_to_message_id) VALUES ($1,'assistant','foreign reply',$2)",
      [otherId, saved.message.id],
    ),
    (error: any) => error.code === "23514",
  );
});

test("existing queue alone owns processing state, denies direct clients and never exposes identities in DTOs", async () => {
  const table = (
    await pool.query(
      "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.background_jobs'::regclass",
    )
  ).rows[0];
  assert.equal(table.relrowsecurity, true);
  assert.equal(
    (
      await pool.query(
        "SELECT to_regclass('public.message_processing') as removed",
      )
    ).rows[0].removed,
    null,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int as count FROM information_schema.columns WHERE table_schema='public' AND table_name='message_images' AND column_name='status'",
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int as count FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_tool_calls' AND column_name='conversation_id'",
      )
    ).rows[0].count,
    0,
  );

  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int as count FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE c.oid='public.background_jobs'::regclass AND acl.grantee=0",
      )
    ).rows[0].count,
    0,
  );

  for (const row of (
    await pool.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')",
    )
  ).rows) {
    const value = (
      await pool.query(
        "SELECT has_table_privilege($1, 'public.background_jobs', 'SELECT,INSERT,UPDATE,DELETE') AS allowed",
        [row.rolname],
      )
    ).rows[0];
    assert.equal(value.allowed, false);
  }

  const id = await conversation();
  const saved = await read(
    await call("/messages/conversation/messages", customer.cookie, {
      conversationId: id,
      body: "scope",
    }),
  );
  assert.equal(JSON.stringify(saved).includes("jobId"), false);
  assert.equal(JSON.stringify(saved).includes("leaseToken"), false);
  await run();
});

test("final expired lease after reply commit reconciles completed state instead of a false terminal failure", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("final crash", id),
    ),
  );
  await run();
  const before = textCalls.length;
  await pool.query(
    "UPDATE background_jobs SET status = 'running', attempts = 4, completed_at = NULL, lease_token = $2, lease_expires_at = clock_timestamp() - interval '1 second' WHERE type = 'process_image_message' AND dedupe_key = $1",
    [saved.message.id, randomUUID()],
  );
  assert.equal(await run(), false);
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "completed",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT status FROM background_jobs WHERE type = 'process_image_message' AND dedupe_key = $1",
        [saved.message.id],
      )
    ).rows[0].status,
    "completed",
  );
  assert.equal(textCalls.length, before);
});

test("expiry recovery waits for an in-flight final reply transaction before deciding failure", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("commit race", id),
    ),
  );
  await lastAttempt(saved.message.id);
  const claimed = await claimJobData(db, 100, backgroundJobPolicies);
  assert.ok(claimed);
  const held = gate();

  const domain = db.transaction().execute(async (trx) => {
    await assertImageMessageJobLeaseData(trx, {
      jobId: claimed.id,
      leaseToken: claimed.lease_token,
    });
    await trx
      .insertInto("messages")
      .values({
        conversation_id: id,
        sender_role: "assistant",
        body: "committing reply",
        reply_to_message_id: saved.message.id,
      })
      .execute();
    await held.wait();
  });

  await held.started;
  await new Promise((resolve) => setTimeout(resolve, 130));
  const recovering = run();
  await new Promise((resolve) => setTimeout(resolve, 20));
  held.release();
  await domain;
  assert.equal(await recovering, false);
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "completed",
  );
  assert.equal(
    (
      await pool.query("SELECT status FROM background_jobs WHERE id = $1", [
        claimed.id,
      ])
    ).rows[0].status,
    "completed",
  );
});

test("final expired job derives completed suppression after takeover without a second model call", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("suppressed crash", id),
    ),
  );
  await lastAttempt(saved.message.id);
  await pool.query(
    "UPDATE message_images SET interpretation = $2::jsonb WHERE message_id = $1",
    [saved.message.id, JSON.stringify(observation)],
  );
  const claim = await claimJobData(db, 60_000, backgroundJobPolicies);
  assert.ok(claim);
  await read(
    await call(`/admin/conversations/${id}/messages`, team.cookie, {
      body: "taking over",
    }),
  );
  await pool.query(
    "UPDATE background_jobs SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [claim.id],
  );
  const before = textCalls.length;
  assert.equal(await run(), false);
  assert.equal(
    (await current(id, saved.message.id)).processing.status,
    "suppressed",
  );
  assert.equal(textCalls.length, before);
});

test("malformed message job payload cannot become success through no-image recovery or break queue UUID casts", async () => {
  const id = await conversation();
  const saved = await read(
    await call(
      "/messages/conversation/messages",
      customer.cookie,
      form("invalid payload", id),
    ),
  );
  await pool.query(
    "UPDATE background_jobs SET payload = '{}'::jsonb WHERE type='process_image_message' AND dedupe_key=$1",
    [saved.message.id],
  );
  assert.equal(await run(), true);
  assert.deepEqual((await current(id, saved.message.id)).processing, {
    status: "failed",
    errorCode: "invalid_payload",
    canRetry: false,
    replyPending: false,
  });
  await pool.query(
    "INSERT INTO background_jobs(type,payload,dedupe_key) VALUES ('process_image_message','{}','not-a-uuid')",
  );
  assert.equal(await run(), true);
  assert.equal(
    (
      await pool.query(
        "SELECT status,last_error FROM background_jobs WHERE dedupe_key='not-a-uuid'",
      )
    ).rows[0].status,
    "failed",
  );
});

test("an image job without attachments fails without invoking the text model", async () => {
  const id = await conversation();
  const messageId = randomUUID();
  await db
    .insertInto("messages")
    .values({
      id: messageId,
      conversation_id: id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "no image",
    })
    .execute();
  await pool.query(
    "INSERT INTO background_jobs(type,payload,dedupe_key) VALUES ('process_image_message',$1::jsonb,$2)",
    [
      JSON.stringify({ messageId, conversationId: id, aiVersion: 0 }),
      messageId,
    ],
  );
  const before = textCalls.length;
  assert.equal(await run(), true);
  assert.equal(textCalls.length, before);
  assert.deepEqual((await current(id, messageId)).processing, {
    status: "failed",
    errorCode: "invalid_payload",
    canRetry: false,
    replyPending: false,
  });
});
