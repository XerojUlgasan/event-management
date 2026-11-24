import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { generateText } from "ai";
import { config } from "../src/env.js";
import { getTextModel, getVisionModel } from "../src/services/ai/models.js";

function useEnvironment(context: TestContext, source: NodeJS.ProcessEnv = {}) {
  context.mock.property(process, "env", source);

  return source;
}

test("defaults, empty values, and required database settings retain their semantics", (context) => {
  const source = useEnvironment(context);
  assert.equal(config.API_PORT, 3000);
  assert.equal(config.DB_HOST, "localhost");
  assert.equal(config.DB_PORT, "5432");
  assert.deepEqual(config.WEB_ORIGINS, ["http://localhost:4321"]);
  assert.equal(config.SESSION_TTL_MS, 7 * 86400000);
  assert.equal(config.SEED_RANDOM_SEED, "clemora-scenario-v1");
  assert.throws(() => config.DB_NAME, /DB_NAME is required/);
  source.DB_NAME = "";
  assert.throws(() => config.DB_NAME, /DB_NAME is required/);
  source.DB_NAME = " db ";
  assert.equal(config.DB_NAME, " db ");
  source.DB_USER = "user";
  source.DB_PASSWORD = "password";
  assert.equal(config.DB_USER, "user");
  assert.equal(config.DB_PASSWORD, "password");
  source.API_PORT = "";
  source.DB_HOST = "";
  source.WEB_ORIGIN = "";
  source.SESSION_TTL_DAYS = "0";
  source.SEED_RANDOM_SEED = "";
  assert.equal(config.API_PORT, 0);
  assert.equal(config.DB_HOST, "");
  assert.deepEqual(config.WEB_ORIGINS, []);
  assert.equal(config.SESSION_TTL_MS, 7 * 86400000);
  assert.equal(config.SEED_RANDOM_SEED, "");
  source.SESSION_TTL_DAYS = "invalid";
  assert.equal(config.SESSION_TTL_MS, 7 * 86400000);
  source.SESSION_TTL_DAYS = "1.5";
  assert.equal(config.SESSION_TTL_MS, 1.5 * 86400000);
});

test("storage is checked on use and keys use existing precedence", (context) => {
  const source = useEnvironment(context);
  assert.throws(() => config.STORAGE, /Media storage is not configured/);
  source.SUPABASE_URL = " https://storage.example/ ";
  source.SUPABASE_SECRET_KEYS = '{"default":" json ","other":"other"}';
  assert.deepEqual(config.STORAGE, {
    url: "https://storage.example",
    apiKey: "json",
    bucket: "event-management",
  });
  source.SUPABASE_SECRET_KEY = " fallback ";
  source.SUPABASE_SERVICE_ROLE_KEY = " direct ";
  source.SUPABASE_STORAGE_BUCKET = " bucket ";
  assert.equal(config.STORAGE.apiKey, "direct");
  assert.equal(config.STORAGE.bucket, "bucket");
  source.SUPABASE_SERVICE_ROLE_KEY = " ";
  assert.equal(config.STORAGE.apiKey, "fallback");
  source.SUPABASE_SECRET_KEY = "";
  source.SUPABASE_SECRET_KEYS = '{"other":" first ","second":"second"}';
  assert.equal(config.STORAGE.apiKey, "first");
  source.SUPABASE_SECRET_KEYS = "invalid";
  assert.throws(() => config.STORAGE, /Media storage is not configured/);
});

test("Realtime prefers JWK signing and restricts legacy signing to local Supabase", (context) => {
  const source = useEnvironment(context, {
    REALTIME_JWT_SECRET: " fixture-secret ",
    REALTIME_JWT_SIGNING_JWK: " fixture-jwk ",
    SUPABASE_URL: "http://127.0.0.1:54321",
  });
  assert.deepEqual(config.REALTIME_SIGNING, {
    algorithm: "ES256",
    jwk: "fixture-jwk",
  });
  delete source.REALTIME_JWT_SIGNING_JWK;

  for (const target of [
    "https://project.supabase.co",
    "http://localhost.example",
    "ftp://localhost",
    "invalid",
  ]) {
    source.SUPABASE_URL = target;
    assert.equal(config.REALTIME_SIGNING, undefined);
  }

  for (const target of [
    "http://127.0.0.1:54321",
    "http://kong:8000",
    "http://[::1]:54321",
  ]) {
    source.SUPABASE_URL = target;
    assert.deepEqual(config.REALTIME_SIGNING, {
      algorithm: "HS256",
      secret: "fixture-secret",
    });
  }

  source.NODE_ENV = "production";
  assert.equal(config.REALTIME_SIGNING, undefined);
});

test("AI text configuration is lazy and does not require unused model roles", (context) => {
  const source = useEnvironment(context);
  assert.equal(config.API_PORT, 3000);
  assert.throws(() => config.AI_TEXT, /AI text model is not configured/);
  source.AI_GATEWAY_API_KEY = " fixture-key ";
  assert.throws(() => config.AI_TEXT, /AI text model is not configured/);
  source.TEXT_MODEL = " fixture/model ";
  assert.deepEqual(config.AI_TEXT, {
    apiKey: "fixture-key",
    model: "fixture/model",
  });
  source.TEXT_MODEL = " ";
  assert.throws(() => config.AI_TEXT, /AI text model is not configured/);
});

test("getters read current values and normalize Firebase and origins", (context) => {
  const source = useEnvironment(context);
  const snapshot = config.WEB_ORIGINS;
  source.WEB_ORIGIN = " https://one.example, ,https://two.example ";
  source.FIREBASE_PROJECT_ID = " project ";
  source.FIREBASE_CLIENT_EMAIL = " email ";
  source.FIREBASE_PRIVATE_KEY = " key\\nline ";
  source.NODE_ENV = "production";
  assert.deepEqual(snapshot, ["http://localhost:4321"]);
  assert.deepEqual(config.WEB_ORIGINS, [
    "https://one.example",
    "https://two.example",
  ]);
  assert.deepEqual(config.FIREBASE_ADMIN, {
    kind: "serviceAccount",
    projectId: "project",
    clientEmail: "email",
    privateKey: "key\nline",
  });
  source.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  source.GOOGLE_APPLICATION_CREDENTIALS = "fixture.json";
  assert.deepEqual(config.FIREBASE_ADMIN, {
    kind: "emulator",
    projectId: "project",
  });
  delete source.FIREBASE_AUTH_EMULATOR_HOST;
  assert.equal(config.FIREBASE_ADMIN.kind, "serviceAccount");
  delete source.FIREBASE_PRIVATE_KEY;
  assert.deepEqual(config.FIREBASE_ADMIN, {
    kind: "file",
    credentialsPath: "fixture.json",
    projectId: "project",
  });
  assert.equal(config.NODE_ENV, "production");
});

test("Gateway text and vision models use the key resolved by config", async (context) => {
  const source = useEnvironment(context, {
    AI_GATEWAY_API_KEY: " fixture-key ",
    TEXT_MODEL: "fixture/text",
    VISION_MODEL: "fixture/vision",
  });
  const models = [getTextModel(), getVisionModel()];
  delete source.AI_GATEWAY_API_KEY;

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

  for (const model of models)
    await assert.rejects(
      generateText({ model, prompt: "test", maxRetries: 0 }),
    );

  assert.deepEqual(authorization, ["Bearer fixture-key", "Bearer fixture-key"]);
});

test("embedding configuration is lazy and independent of text replies", (context) => {
  const source = useEnvironment(context);
  assert.throws(
    () => config.AI_EMBEDDING,
    /AI embedding model is not configured/,
  );
  source.AI_GATEWAY_API_KEY = " fixture-key ";
  source.EMBEDDING_MODEL = " google/gemini-embedding-2 ";
  assert.deepEqual(config.AI_EMBEDDING, {
    apiKey: "fixture-key",
    model: "google/gemini-embedding-2",
  });
  assert.throws(() => config.AI_TEXT, /AI text model is not configured/);
});
