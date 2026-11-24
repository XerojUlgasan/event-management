import assert from "node:assert/strict";
import { test } from "node:test";
import { localWorkerEnvironment } from "./dev-background-jobs.mjs";

const status = {
  DB_URL: "postgresql://fixture:fixture%2Fpassword@127.0.0.1:54322/postgres",
  API_URL: "http://127.0.0.1:54321",
  SERVICE_ROLE_KEY: "fixture-local-key",
};

test("Edge worker uses local Supabase host connections and function model settings", () => {
  const result = localWorkerEnvironment(
    {
      SUPABASE_DB_URL: "postgresql://fixture:fixture@db:5432/postgres",
      SUPABASE_URL: "http://kong:8000",
      AI_GATEWAY_API_KEY: "fixture-function-key",
      EMBEDDING_MODEL: "fixture/model",
    },
    status,
    {
      SUPABASE_DB_URL: "postgresql://fixture:fixture@localhost:5432/compose",
      AI_GATEWAY_API_KEY: "fixture-parent-key",
      PATH: "/fixture",
    },
  );
  assert.equal(result.SUPABASE_DB_URL, status.DB_URL);
  assert.equal(result.SUPABASE_URL, status.API_URL);
  assert.equal(result.SUPABASE_SERVICE_ROLE_KEY, status.SERVICE_ROLE_KEY);
  assert.equal(result.AI_GATEWAY_API_KEY, "fixture-function-key");
  assert.equal(result.EMBEDDING_MODEL, "fixture/model");
  assert.equal(result.PATH, "/fixture");
  assert.match(result.DOTENV_CONFIG_PATH, /apps\/supabase\/\.env\.functions$/);
});

test("local worker prefers the Storage secret key and accepts secret-only status", () => {
  for (const legacyKey of [status.SERVICE_ROLE_KEY, undefined]) {
    const result = localWorkerEnvironment(
      { SUPABASE_SERVICE_ROLE_KEY: "fixture-function-key" },
      {
        ...status,
        SERVICE_ROLE_KEY: legacyKey,
        SECRET_KEY: "fixture-local-secret",
      },
    );
    assert.equal(result.SUPABASE_SERVICE_ROLE_KEY, "fixture-local-secret");
  }
});

test("Edge development worker rejects remote or incomplete status", () => {
  assert.throws(() =>
    localWorkerEnvironment(
      {},
      {
        ...status,
        DB_URL: "postgresql://fixture:fixture@remote.invalid/postgres",
      },
    ),
  );
  assert.throws(() =>
    localWorkerEnvironment(
      {},
      { ...status, API_URL: "https://remote.invalid" },
    ),
  );
  assert.throws(() =>
    localWorkerEnvironment({}, { ...status, SERVICE_ROLE_KEY: "" }),
  );
});
