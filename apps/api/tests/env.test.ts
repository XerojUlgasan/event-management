import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { generateText } from "ai";
import { decodeProtectedHeader } from "jose";
import { config } from "../src/env.js";
import {
  getEmbeddingSettings,
  getTextModel,
  getVisionModel,
} from "../src/services/ai/models.js";
import type { SessionContext } from "../src/types/hono.js";
import { signRealtimeToken } from "../src/utils/auth/sign-realtime-token.js";
import { getCatalogStorage } from "../src/utils/catalog-media-storage.js";

function useConfig(context: TestContext, settings: Partial<typeof config>) {
  const original = { ...config };
  Object.assign(config, settings);
  context.after(() => {
    Object.assign(config, original);
  });
}

test("API config is a plain snapshot of raw environment values", (context) => {
  const original = process.env.DB_HOST;
  assert.equal(config.DB_HOST, original);
  context.mock.property(process, "env", {
    ...process.env,
    DB_HOST: original === "fixture" ? "" : "fixture",
  });
  assert.equal(config.DB_HOST, original);

  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(config),
  )) {
    assert.ok("value" in descriptor);
    assert.ok(
      descriptor.value === undefined || typeof descriptor.value === "string",
    );
  }
});

test("storage selects supported keys when used", (context) => {
  useConfig(context, {
    SUPABASE_URL: " https://storage.example/ ",
    SUPABASE_STORAGE_BUCKET: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    SUPABASE_SECRET_KEY: undefined,
    SUPABASE_SECRET_KEYS: '{"default":" json ","other":"other"}',
  });
  assert.deepEqual(getCatalogStorage(), {
    url: "https://storage.example",
    apiKey: "json",
    bucket: "event-management",
  });
  config.SUPABASE_SECRET_KEY = " fallback ";
  config.SUPABASE_SERVICE_ROLE_KEY = " direct ";
  config.SUPABASE_STORAGE_BUCKET = " bucket ";
  assert.equal(getCatalogStorage().apiKey, "direct");
  assert.equal(getCatalogStorage().bucket, "bucket");
  config.SUPABASE_SERVICE_ROLE_KEY = " ";
  assert.equal(getCatalogStorage().apiKey, "fallback");
  config.SUPABASE_SECRET_KEY = "";
  config.SUPABASE_SECRET_KEYS = '{"other":" first ","second":"second"}';
  assert.equal(getCatalogStorage().apiKey, "first");
  config.SUPABASE_SECRET_KEYS = "invalid";
  assert.throws(getCatalogStorage, /Media storage is not configured/);
});

test("Realtime prefers JWK signing and restricts legacy signing to local Supabase", async (context) => {
  useConfig(context, {
    NODE_ENV: "test",
    REALTIME_JWT_SIGNING_JWK: "invalid-jwk",
    REALTIME_JWT_SECRET: "1234567890-fixture-only-1234567890",
    SUPABASE_URL: "http://127.0.0.1:54321",
  });
  const session = {
    sessionId: "fixture-session",
    user: { id: "fixture-user" },
  } as SessionContext;

  const sign = () =>
    signRealtimeToken({ scope: "notifications" }, session, {
      issuedAt: 0,
      expiresAt: 60,
    });

  await assert.rejects(sign, SyntaxError);
  config.REALTIME_JWT_SIGNING_JWK = undefined;

  for (const target of [
    "https://project.supabase.co",
    "http://localhost.example",
    "ftp://localhost",
    "invalid",
  ]) {
    config.SUPABASE_URL = target;
    await assert.rejects(sign, /Realtime token signer is unavailable/);
  }

  for (const target of [
    "http://127.0.0.1:54321",
    "http://kong:8000",
    "http://[::1]:54321",
  ]) {
    config.SUPABASE_URL = target;
    assert.equal(decodeProtectedHeader(await sign()).alg, "HS256");
  }

  config.NODE_ENV = "production";
  await assert.rejects(sign, /Realtime token signer is unavailable/);
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
