import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import {
  agentProfileSchema,
  agentSettingsResponseSchema,
  defaultAgentSettings,
  type AgentSettings,
} from "@event-management/contracts/ai-agent-settings";
import { Pool } from "pg";
import { hashSessionToken } from "../../src/utils/session.js";
import { setTestConfig } from "../helpers/set-test-config.js";

const database = `em_ai_agent_settings_${randomUUID().replaceAll("-", "")}`;

const adminPath = "/admin/ai/agent-settings";
const previewPath = "/admin/ai/agent-settings/preview";
const publicPath = "/ai/agent-profile";

let adminPool: Pool | undefined;
let pool: Pool | undefined;
let db: typeof import("../../src/db/client.js").db | undefined;
let app: typeof import("../../src/app.js").app;
let edge: typeof import("../../src/edge/server.js").app;
let adminCookie: string;
let customerCookie: string;

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

  const migrations = new URL("../../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(
        new URL(`${entry.name}/migration.sql`, migrations),
        "utf8",
      ),
    );

  setTestConfig({ DB_NAME: database });
  ({ app } = await import("../../src/app.js"));
  ({ app: edge } = await import("../../src/edge/server.js"));
  ({ db } = await import("../../src/db/client.js"));

  async function session(role: "admin" | "customer") {
    const token = randomUUID();
    const user = await db!
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        role,
        password_hash: "unused",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db!
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3_600_000),
      })
      .execute();

    return `em_session=${token}`;
  }

  adminCookie = await session("admin");
  customerCookie = await session("customer");
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

function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  runtime = app,
) {
  return runtime.request(`/v1${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function readSettings(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());

  return agentSettingsResponseSchema.parse(await response.json());
}

const settings = (displayName: string): AgentSettings => ({
  ...defaultAgentSettings,
  displayName,
  greeting: "How can I help with your event?",
  personality: "friendly",
  additionalInstructions: "Keep answers concise.",
  allowBusinessInformation: false,
  allowPublicCatalog: true,
});

test("settings API returns seeded defaults and public route exposes only profile fields", async () => {
  const current = await readSettings(
    await request(adminPath, "GET", undefined, adminCookie),
  );
  assert.deepEqual(current.settings, defaultAgentSettings);
  assert.equal(current.revision, 1);

  const publicResponse = await request(
    publicPath,
    "GET",
    undefined,
    undefined,
    edge,
  );
  assert.equal(publicResponse.status, 200, await publicResponse.clone().text());
  const rawProfile = await publicResponse.json();
  const profile = agentProfileSchema.parse(rawProfile);
  assert.deepEqual(profile, {
    displayName: defaultAgentSettings.displayName,
    greeting: defaultAgentSettings.greeting,
  });
  assert.deepEqual(Object.keys(rawProfile).sort(), ["displayName", "greeting"]);
});

test("admin compare-and-swap permits one concurrent writer and rejects the stale revision", async () => {
  const initial = await readSettings(
    await request(adminPath, "GET", undefined, adminCookie),
  );
  const candidates = [settings("AMAC One"), settings("AMAC Two")];

  const responses = await Promise.all(
    candidates.map((candidate, index) =>
      request(
        adminPath,
        "PUT",
        { settings: candidate, expectedRevision: initial.revision },
        adminCookie,
        index === 0 ? app : edge,
      ),
    ),
  );

  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);

  const winnerIndex = responses.findIndex(({ status }) => status === 200);

  const winner = await readSettings(responses[winnerIndex]!);
  assert.deepEqual(winner.settings, candidates[winnerIndex]);
  assert.equal(winner.revision, initial.revision + 1);
  const persisted = await pool!.query(
    "SELECT display_name, revision FROM ai_agent_settings WHERE id = 1",
  );
  assert.equal(persisted.rowCount, 1);
  assert.equal(persisted.rows[0]?.display_name, winner.settings.displayName);
  assert.equal(persisted.rows[0]?.revision, winner.revision);
});

test("admin settings routes require an admin session", async () => {
  assert.equal((await request(adminPath)).status, 401);
  assert.equal(
    (await request(adminPath, "GET", undefined, customerCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(previewPath, "POST", {
        settings: settings("Unsaved Preview"),
        messages: [{ role: "user", content: "I am planning a wedding." }],
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        previewPath,
        "POST",
        {
          settings: settings("Unsaved Preview"),
          messages: [{ role: "user", content: "I am planning a wedding." }],
        },
        customerCookie,
      )
    ).status,
    403,
  );
});

test("preview accepts unsaved settings and messages without persisting them", async () => {
  const before = await readSettings(
    await request(adminPath, "GET", undefined, adminCookie),
  );
  const previewSettings = settings("Preview Only AMAC");
  const response = await request(
    previewPath,
    "POST",
    {
      settings: previewSettings,
      messages: [{ role: "user", content: "I am planning a wedding." }],
    },
    adminCookie,
  );
  assert.equal(response.status, 200, await response.clone().text());
  const result = (await response.json()) as {
    reply: string;
    mode: "sample" | "model";
  };
  assert.equal(typeof result.reply, "string");
  assert.ok(["sample", "model"].includes(result.mode));

  const after = await readSettings(
    await request(adminPath, "GET", undefined, adminCookie),
  );
  assert.deepEqual(after, before);
  const persisted = await pool!.query(
    "SELECT display_name, revision FROM ai_agent_settings WHERE id = 1",
  );
  assert.equal(persisted.rows[0]?.display_name, before.settings.displayName);
  assert.equal(persisted.rows[0]?.revision, before.revision);
});
