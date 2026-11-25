import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { generateText } from "ai";
import { jwtVerify } from "jose";
import { config } from "../src/env.js";
import {
  getEmbeddingSettings,
  getTextModel,
  getVisionModel,
} from "../src/services/ai/models.js";
import type { SessionContext } from "../src/types/hono.js";
import { signRealtimeToken } from "../src/utils/auth/sign-realtime-token.js";

function useConfig(context: TestContext, settings: Partial<typeof config>) {
  const original = { ...config };
  Object.assign(config, settings);
  context.after(() => {
    Object.assign(config, original);
  });
}

test("API config is a plain snapshot of raw environment values", (context) => {
  const original = process.env.SUPABASE_DB_URL;
  assert.equal(config.SUPABASE_DB_URL, original);
  context.mock.property(process, "env", {
    ...process.env,
    SUPABASE_DB_URL: original === "fixture" ? "" : "fixture",
  });
  assert.equal(config.SUPABASE_DB_URL, original);

  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(config),
  )) {
    assert.ok("value" in descriptor);
    assert.ok(
      descriptor.value === undefined || typeof descriptor.value === "string",
    );
  }
});

test("Realtime signs with SUP_JWT_KEY on local and hosted Edge", async (context) => {
  const secret = "1234567890-fixture-only-1234567890";
  useConfig(context, { SUP_JWT_KEY: secret });
  const session = {
    sessionId: "fixture-session",
    user: { id: "fixture-user" },
  } as SessionContext;

  const sign = () =>
    signRealtimeToken({ scope: "notifications" }, session, {
      issuedAt: 0,
      expiresAt: 60,
    });

  for (const environment of ["development", "production"]) {
    config.NODE_ENV = environment;
    const { payload } = await jwtVerify(
      await sign(),
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
        audience: "authenticated",
        currentDate: new Date(30_000),
      },
    );
    assert.equal(payload.clemora_scope, "user_notifications");
  }

  for (const invalid of [undefined, " ".repeat(32), "x".repeat(31)]) {
    config.SUP_JWT_KEY = invalid;
    await assert.rejects(sign, /Realtime token signer is unavailable/);
  }
});

test("AI text and embedding settings are validated independently on use", (context) => {
  useConfig(context, {
    AI_GATEWAY_API_KEY: undefined,
    TEXT_MODEL: undefined,
    EMBEDDING_MODEL: undefined,
  });
  assert.throws(getTextModel, /AI text model is not configured/);
  assert.throws(getEmbeddingSettings, /AI embedding model is not configured/);
  config.AI_GATEWAY_API_KEY = " fixture-key ";
  config.EMBEDDING_MODEL = " google/gemini-embedding-2 ";
  assert.deepEqual(getEmbeddingSettings(), {
    apiKey: "fixture-key",
    model: "google/gemini-embedding-2",
  });
  assert.throws(getTextModel, /AI text model is not configured/);
});

test("Gateway text and vision use the explicit config credential", async (context) => {
  useConfig(context, {
    AI_GATEWAY_API_KEY: " fixture-key ",
    TEXT_MODEL: "fixture/text",
    VISION_MODEL: "fixture/vision",
  });

  const authorization: (string | null)[] = [];
  context.mock.method(
    globalThis,
    "fetch",
    async (_input: unknown, init?: RequestInit) => {
      authorization.push(new Headers(init?.headers).get("authorization"));

      return Response.json(
        { error: { message: "fixture rejection" } },
        { status: 400 },
      );
    },
  );

  for (const model of [getTextModel(), getVisionModel()])
    await assert.rejects(
      generateText({ model, prompt: "test", maxRetries: 0 }),
    );

  assert.deepEqual(authorization, ["Bearer fixture-key", "Bearer fixture-key"]);
});
