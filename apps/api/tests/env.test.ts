import assert from "node:assert/strict";
import { test } from "node:test";
import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { config } from "../src/env.js";
import { getTextModel } from "../src/services/ai/models.js";
import type { SessionContext } from "../src/types/hono.js";
import { signRealtimeToken } from "../src/utils/auth/sign-realtime-token.js";
import { getCatalogStorage } from "../src/utils/catalog-media-storage.js";

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

test("R2 configuration is validated only when Storage is used", () =>
  withConfig(
    {
      R2_ENDPOINT: " https://storage.invalid/ ",
      R2_BUCKET_NAME: " fixture-bucket ",
      R2_ACCESS_KEY_ID: "fixture-access-key",
      R2_SECRET_ACCESS_KEY: undefined,
    },
    () => {
      assert.throws(getCatalogStorage, /R2_SECRET_ACCESS_KEY/);
      config.R2_SECRET_ACCESS_KEY = "fixture-secret";
      assert.equal(getCatalogStorage().endpoint, "https://storage.invalid");
      assert.equal(getCatalogStorage().bucket, "fixture-bucket");
      config.R2_ENDPOINT = "https://storage.invalid/?key=example";
      assert.throws(getCatalogStorage, /R2_ENDPOINT/);
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

test("Realtime signs with one private ES256 JWK from the environment", async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const jwk = {
    ...(await exportJWK(privateKey)),
    kid: "realtime-fixture",
    use: "sig",
    alg: "ES256",
    key_ops: ["sign", "verify"],
  };
  const session = {
    sessionId: "fixture-session",
    user: { id: "fixture-user" },
  } as SessionContext;
  const issuedAt = Math.floor(Date.now() / 1000);

  const sign = () =>
    signRealtimeToken({ scope: "notifications" }, session, {
      issuedAt,
      expiresAt: issuedAt + 60,
    });

  await withConfig(
    {
      SUP_JWT_KEY: JSON.stringify([jwk]),
      REALTIME_JWT_SIGNING_JWK: "invalid-fallback",
    },
    async () => {
      for (const value of [JSON.stringify([jwk]), JSON.stringify(jwk)]) {
        config.SUP_JWT_KEY = value;
        const { protectedHeader, payload } = await jwtVerify(
          await sign(),
          publicKey,
          { algorithms: ["ES256"], audience: "authenticated" },
        );
        assert.equal(protectedHeader.kid, jwk.kid);
        assert.equal(payload.sub, session.user.id);
        assert.equal(payload.clemora_scope, "user_notifications");
      }

      config.REALTIME_JWT_SIGNING_JWK = JSON.stringify(jwk);
      const publicJwk = { ...(await exportJWK(publicKey)), kid: jwk.kid };

      for (const invalid of [[], [jwk, jwk], [publicJwk]]) {
        config.SUP_JWT_KEY = JSON.stringify(invalid);
        await assert.rejects(sign);
      }

      config.SUP_JWT_KEY = undefined;
      await jwtVerify(await sign(), publicKey, { algorithms: ["ES256"] });
    },
  );
});
