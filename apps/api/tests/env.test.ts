import assert from "node:assert/strict";
import { test } from "node:test";
import { createEnv } from "../src/utils/env.js";

test("defaults, empty values, and required database settings retain their semantics", () => {
  const source: Record<string, string | undefined> = {};
  const env = createEnv(source);
  assert.equal(env.API_PORT, 3000);
  assert.equal(env.DB_HOST, "localhost");
  assert.equal(env.DB_PORT, "5432");
  assert.deepEqual(env.WEB_ORIGINS, ["http://localhost:4321"]);
  assert.equal(env.SESSION_TTL_MS, 7 * 86400000);
  assert.equal(env.SEED_RANDOM_SEED, "clemora-scenario-v1");
  assert.throws(() => env.DB_NAME, /DB_NAME is required/);
  source.DB_NAME = "";
  assert.throws(() => env.DB_NAME, /DB_NAME is required/);
  source.DB_NAME = " db ";
  assert.equal(env.DB_NAME, " db ");
  source.DB_USER = "user";
  source.DB_PASSWORD = "password";
  assert.equal(env.DB_USER, "user");
  assert.equal(env.DB_PASSWORD, "password");
  source.API_PORT = "";
  source.DB_HOST = "";
  source.WEB_ORIGIN = "";
  source.SESSION_TTL_DAYS = "0";
  source.SEED_RANDOM_SEED = "";
  assert.equal(env.API_PORT, 0);
  assert.equal(env.DB_HOST, "");
  assert.deepEqual(env.WEB_ORIGINS, []);
  assert.equal(env.SESSION_TTL_MS, 7 * 86400000);
  assert.equal(env.SEED_RANDOM_SEED, "");
  source.SESSION_TTL_DAYS = "invalid";
  assert.equal(env.SESSION_TTL_MS, 7 * 86400000);
  source.SESSION_TTL_DAYS = "1.5";
  assert.equal(env.SESSION_TTL_MS, 1.5 * 86400000);
});

test("storage is checked on use and keys use existing precedence", () => {
  const source: Record<string, string | undefined> = {};
  const env = createEnv(source);
  assert.throws(() => env.STORAGE, /Media storage is not configured/);
  source.SUPABASE_URL = " https://storage.example/ ";
  source.SUPABASE_SECRET_KEYS = '{"default":" json ","other":"other"}';
  assert.deepEqual(env.STORAGE, {
    url: "https://storage.example",
    apiKey: "json",
    bucket: "event-management",
  });
  source.SUPABASE_SECRET_KEY = " fallback ";
  source.SUPABASE_SERVICE_ROLE_KEY = " direct ";
  source.SUPABASE_STORAGE_BUCKET = " bucket ";
  assert.equal(env.STORAGE.apiKey, "direct");
  assert.equal(env.STORAGE.bucket, "bucket");
  source.SUPABASE_SERVICE_ROLE_KEY = " ";
  assert.equal(env.STORAGE.apiKey, "fallback");
  source.SUPABASE_SECRET_KEY = "";
  source.SUPABASE_SECRET_KEYS = '{"other":" first ","second":"second"}';
  assert.equal(env.STORAGE.apiKey, "first");
  source.SUPABASE_SECRET_KEYS = "invalid";
  assert.throws(() => env.STORAGE, /Media storage is not configured/);
});

test("Realtime legacy signing is restricted to local Supabase targets", () => {
  const source: Record<string, string | undefined> = {
    REALTIME_JWT_SECRET: " fixture-secret ",
    REALTIME_JWT_SIGNING_JWK: " fixture-jwk ",
  };
  const env = createEnv(source);
  assert.deepEqual(env.REALTIME_SIGNING, {
    jwk: "fixture-jwk",
    localSecret: undefined,
  });

  for (const target of [
    "https://project.supabase.co",
    "http://localhost.example",
    "ftp://localhost",
    "invalid",
  ]) {
    source.SUPABASE_URL = target;
    assert.equal(env.REALTIME_SIGNING.localSecret, undefined);
  }

  for (const target of [
    "http://127.0.0.1:54321",
    "http://kong:8000",
    "http://[::1]:54321",
  ]) {
    source.SUPABASE_URL = target;
    assert.equal(env.REALTIME_SIGNING.localSecret, "fixture-secret");
  }

  source.NODE_ENV = "production";
  assert.equal(env.REALTIME_SIGNING.localSecret, undefined);
});

test("AI text configuration is lazy and does not require unused model roles", () => {
  const source: Record<string, string | undefined> = {};
  const env = createEnv(source);
  assert.equal(env.API_PORT, 3000);
  assert.throws(() => env.AI_TEXT, /AI text model is not configured/);
  source.AI_GATEWAY_API_KEY = " fixture-key ";
  assert.throws(() => env.AI_TEXT, /AI text model is not configured/);
  source.TEXT_MODEL = " fixture/model ";
  assert.deepEqual(env.AI_TEXT, {
    apiKey: "fixture-key",
    model: "fixture/model",
  });
  source.TEXT_MODEL = " ";
  assert.throws(() => env.AI_TEXT, /AI text model is not configured/);
});

test("getters read current values and normalize Firebase and origins", () => {
  const source: Record<string, string | undefined> = {};
  const env = createEnv(source);
  const snapshot = env.WEB_ORIGINS;
  source.WEB_ORIGIN = " https://one.example, ,https://two.example ";
  source.FIREBASE_PROJECT_ID = " project ";
  source.FIREBASE_CLIENT_EMAIL = " email ";
  source.FIREBASE_PRIVATE_KEY = " key\\nline ";
  source.NODE_ENV = "production";
  assert.deepEqual(snapshot, ["http://localhost:4321"]);
  assert.deepEqual(env.WEB_ORIGINS, [
    "https://one.example",
    "https://two.example",
  ]);
  assert.equal(env.FIREBASE_PROJECT_ID, "project");
  assert.equal(env.FIREBASE_CLIENT_EMAIL, "email");
  assert.equal(env.FIREBASE_PRIVATE_KEY, "key\nline");
  assert.equal(env.NODE_ENV, "production");
});

test("embedding configuration is lazy and independent of text replies", () => {
  const source: Record<string, string | undefined> = {};
  const env = createEnv(source);
  assert.throws(() => env.AI_EMBEDDING, /AI embedding model is not configured/);
  source.AI_GATEWAY_API_KEY = " fixture-key ";
  source.EMBEDDING_MODEL = " google/gemini-embedding-2 ";
  assert.deepEqual(env.AI_EMBEDDING, {
    apiKey: "fixture-key",
    model: "google/gemini-embedding-2",
  });
  assert.throws(() => env.AI_TEXT, /AI text model is not configured/);
});
