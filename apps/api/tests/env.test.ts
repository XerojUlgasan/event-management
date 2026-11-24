import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../src/env.js";

function withEnv(
  settings: Record<string, string | undefined>,
  run: () => void,
) {
  const previous = Object.fromEntries(
    Object.keys(settings).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("required values are lazy, named, and read on access", () => {
  withEnv(
    {
      DB_HOST: undefined,
      SESSION_TTL_DAYS: "0",
      WEB_ORIGIN: "https://one.example, https://two.example",
    },
    () => {
      assert.throws(() => config.DB_HOST, /DB_HOST is required/);
      assert.throws(() => config.SESSION_TTL_DAYS, /SESSION_TTL_DAYS/);
      assert.deepEqual(config.WEB_ORIGIN, [
        "https://one.example",
        "https://two.example",
      ]);
      process.env.DB_HOST = "localhost";
      assert.equal(config.DB_HOST, "localhost");
    },
  );
});

test("storage credentials retain supported source precedence", () => {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_SECRET_KEY: undefined,
      SUPABASE_SECRET_KEYS: undefined,
      STORAGE_BUCKET: undefined,
    },
    () => {
      assert.throws(() => config.SUPABASE_STORAGE_KEY, /SUPABASE_SECRET_KEYS/);
      assert.throws(
        () => config.STORAGE_BUCKET,
        /STORAGE_BUCKET/,
      );
      process.env.SUPABASE_SECRET_KEYS = '{"default":" json ","other":"other"}';
      assert.equal(config.SUPABASE_STORAGE_KEY, "json");
      process.env.SUPABASE_SECRET_KEY = "secret";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "role";
      assert.equal(config.SUPABASE_STORAGE_KEY, "role");
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      assert.equal(config.SUPABASE_STORAGE_KEY, "secret");
      delete process.env.SUPABASE_SECRET_KEY;
      process.env.SUPABASE_SECRET_KEYS = '{"other":"first"}';
      assert.equal(config.SUPABASE_STORAGE_KEY, "first");
    },
  );
});

test("Realtime legacy signing is restricted to local non-production targets", () => {
  withEnv(
    {
      REALTIME_JWT_SECRET: "secret",
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
    },
    () => {
      assert.equal(config.REALTIME_JWT_SECRET, undefined);
      process.env.SUPABASE_URL = "http://kong:8000";
      assert.equal(config.REALTIME_JWT_SECRET, "secret");
      process.env.NODE_ENV = "production";
      assert.equal(config.REALTIME_JWT_SECRET, undefined);
    },
  );
});

test("AI model and key are required only when the model is used", () => {
  withEnv({ AI_GATEWAY_API_KEY: undefined, TEXT_MODEL: undefined }, () => {
    assert.throws(() => config.TEXT_MODEL, /AI_GATEWAY_API_KEY/);
    process.env.AI_GATEWAY_API_KEY = "key";
    assert.throws(() => config.TEXT_MODEL, /TEXT_MODEL/);
    process.env.TEXT_MODEL = " model/id ";
    assert.equal(config.TEXT_MODEL, "model/id");
  });
});
