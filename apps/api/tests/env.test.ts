import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../src/env.js";
import { getTextModel } from "../src/services/ai/models.js";
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
