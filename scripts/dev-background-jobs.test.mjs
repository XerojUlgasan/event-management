import assert from "node:assert/strict";
import { test } from "node:test";
import { localWorkerEnvironment } from "./dev-background-jobs.mjs";

const status = {
  DB_URL: "postgresql://fixture:fixture%2Fpassword@127.0.0.1:54322/postgres",
};

test("Edge worker uses local Supabase host connections and function model settings", () => {
  const result = localWorkerEnvironment(
    {
      SUPABASE_DB_URL: "postgresql://fixture:fixture@db:5432/postgres",
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
  assert.equal(result.AI_GATEWAY_API_KEY, "fixture-function-key");
  assert.equal(result.EMBEDDING_MODEL, "fixture/model");
  assert.equal(result.PATH, "/fixture");
  assert.match(result.DOTENV_CONFIG_PATH, /apps\/supabase\/\.env\.functions$/);
});

test("local worker reads R2 settings from the same function environment as Edge", () => {
  const parentEnv = {
    S3_API_URL: "https://inherited.invalid",
    R2_ACCESS_KEY_ID: "inherited-id",
    R2_SECRET_ACCESS_KEY: "inherited-secret",
    R2_BUCKET_NAME: "inherited-bucket",
  };
  const endpoint = "https://local.r2.cloudflarestorage.com";
  const result = localWorkerEnvironment(
    { S3_API_URL: endpoint },
    status,
    parentEnv,
  );
  assert.equal(result.S3_API_URL, endpoint);
  assert.equal(result.R2_ACCESS_KEY_ID, undefined);
  assert.equal(result.R2_SECRET_ACCESS_KEY, undefined);
  assert.equal(result.R2_BUCKET_NAME, undefined);
  assert.equal(
    localWorkerEnvironment({}, status, parentEnv).S3_API_URL,
    undefined,
  );
});

test("Edge development worker rejects a remote database", () => {
  assert.throws(() =>
    localWorkerEnvironment(
      {},
      {
        ...status,
        DB_URL: "postgresql://fixture:fixture@remote.invalid/postgres",
      },
    ),
  );
});
