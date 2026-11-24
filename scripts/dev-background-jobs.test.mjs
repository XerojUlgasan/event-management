import assert from "node:assert/strict";
import { test } from "node:test";
import { localWorkerEnvironment } from "./dev-background-jobs.mjs";

const status = {
  DB_URL: "postgresql://fixture:fixture%2Fpassword@127.0.0.1:54322/postgres",
  API_URL: "http://127.0.0.1:54321",
  STORAGE_S3_URL: "http://127.0.0.1:54321/storage/v1/s3",
  S3_PROTOCOL_ACCESS_KEY_ID: "fixture-access-key",
  S3_PROTOCOL_ACCESS_KEY_SECRET: "fixture-secret-key",
  S3_PROTOCOL_REGION: "local",
};

test("Edge worker uses local Supabase host connections and function model settings", () => {
  const result = localWorkerEnvironment(
    {
      DB_HOST: "db",
      DB_PORT: "5432",
      R2_ENDPOINT: "http://kong:8000/storage/v1/s3",
      AI_GATEWAY_API_KEY: "fixture-function-key",
      EMBEDDING_MODEL: "fixture/model",
    },
    status,
    {
      DB_NAME: "compose",
      AI_GATEWAY_API_KEY: "fixture-parent-key",
      PATH: "/fixture",
    },
  );
  assert.equal(result.DB_HOST, "127.0.0.1");
  assert.equal(result.DB_PORT, "54322");
  assert.equal(result.DB_NAME, "postgres");
  assert.equal(result.DB_USER, "fixture");
  assert.equal(result.DB_PASSWORD, "fixture/password");
  assert.equal(result.R2_ENDPOINT, status.STORAGE_S3_URL);
  assert.equal(result.R2_ACCESS_KEY_ID, status.S3_PROTOCOL_ACCESS_KEY_ID);
  assert.equal(
    result.R2_SECRET_ACCESS_KEY,
    status.S3_PROTOCOL_ACCESS_KEY_SECRET,
  );
  assert.equal(result.R2_BUCKET_NAME, "event-management");
  assert.equal(result.R2_DOCUMENTS_BUCKET_NAME, "supporting-documents");
  assert.equal(result.AI_GATEWAY_API_KEY, "fixture-function-key");
  assert.equal(result.EMBEDDING_MODEL, "fixture/model");
  assert.equal(result.PATH, "/fixture");
  assert.match(result.DOTENV_CONFIG_PATH, /apps\/supabase\/\.env\.functions$/);
});

test("Edge worker preserves the function's configured database and database role", () => {
  const result = localWorkerEnvironment(
    {
      DB_NAME: "fixture_catalog",
      DB_USER: "fixture_worker",
      DB_PASSWORD: "fixture-worker-password",
    },
    status,
  );
  assert.equal(result.DB_HOST, "127.0.0.1");
  assert.equal(result.DB_PORT, "54322");
  assert.equal(result.DB_NAME, "fixture_catalog");
  assert.equal(result.DB_USER, "fixture_worker");
  assert.equal(result.DB_PASSWORD, "fixture-worker-password");
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
    localWorkerEnvironment({}, { ...status, S3_PROTOCOL_ACCESS_KEY_ID: "" }),
  );
});
