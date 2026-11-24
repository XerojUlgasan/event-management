import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../src/env.js";
import { getTextModel } from "../src/services/ai/models.js";
import { signRealtimeToken } from "../src/utils/auth/sign-realtime-token.js";
import { getCatalogStorageCredentials } from "../src/utils/catalog-media-storage.js";

async function withConfig(
  settings: Partial<typeof config>,
  run: () => void | Promise<void>,
) {
  const previous = { ...config };
  Object.assign(config, settings);

  try {
    await run();
  } finally {
    Object.assign(config, previous);
  }
}

test("config captures raw values when imported", () => {
  const original = process.env.DB_HOST;

  assert.equal(config.DB_HOST, original);

  try {
    process.env.DB_HOST = " host ";
    assert.equal(config.DB_HOST, original);
  } finally {
    if (original === undefined) delete process.env.DB_HOST;
    else process.env.DB_HOST = original;
  }
});

test("storage credentials retain supported source precedence", () =>
  withConfig(
    {
      SUPABASE_URL: " http://localhost:54321/ ",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_SECRET_KEY: undefined,
      SUPABASE_SECRET_KEYS: undefined,
    },
    () => {
      assert.throws(getCatalogStorageCredentials, /SUPABASE_SECRET_KEYS/);
      config.SUPABASE_SECRET_KEYS = '{"default":" json ","other":"other"}';
      assert.deepEqual(getCatalogStorageCredentials(), {
        url: "http://localhost:54321",
        apiKey: "json",
      });
      config.SUPABASE_SECRET_KEY = "secret";
      config.SUPABASE_SERVICE_ROLE_KEY = "role";
      assert.equal(getCatalogStorageCredentials().apiKey, "role");
      config.SUPABASE_SERVICE_ROLE_KEY = undefined;
      assert.equal(getCatalogStorageCredentials().apiKey, "secret");
      config.SUPABASE_SECRET_KEY = undefined;
      config.SUPABASE_SECRET_KEYS = '{"other":"first"}';
      assert.equal(getCatalogStorageCredentials().apiKey, "first");
    },
  ));

test("Realtime legacy signing is restricted to local non-production targets", () =>
  withConfig(
    {
      REALTIME_JWT_SIGNING_JWK: undefined,
      REALTIME_JWT_SECRET: "test-legacy-secret-at-least-32-bytes",
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
    },
    async () => {
      const date = new Date();
      const issuedAt = Math.floor(date.getTime() / 1000);

      const sign = () =>
        signRealtimeToken(
          { scope: "notifications" },
          {
            sessionId: "test-session",
            expiresAt: date,
            user: {
              id: "test-user",
              created_at: date,
              updated_at: date,
              email: "user@example.test",
              display_name: null,
              firebase_uid: null,
              password_hash: null,
              role: "customer",
            },
          },
          { issuedAt, expiresAt: issuedAt + 60 },
        );

      await assert.rejects(sign, /signer is unavailable/);
      config.SUPABASE_URL = "http://kong:8000";
      assert.match(await sign(), /^[^.]+\.[^.]+\.[^.]+$/);
      config.NODE_ENV = "production";
      await assert.rejects(sign, /signer is unavailable/);
    },
  ));

test("AI model and key are required only when the model is used", () =>
  withConfig({ AI_GATEWAY_API_KEY: undefined, TEXT_MODEL: undefined }, () => {
    assert.throws(getTextModel, /AI_GATEWAY_API_KEY/);
    config.AI_GATEWAY_API_KEY = "key";
    assert.throws(getTextModel, /TEXT_MODEL/);
    config.TEXT_MODEL = " model/id ";
    assert.equal(getTextModel(), "model/id");
  }));
