import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../../src/env.ts";

test("required API settings fail with the missing key and optional integrations stay disabled", () => {
  const original = process.env.PUBLIC_API_URL;
  delete process.env.PUBLIC_API_URL;
  try {
    assert.throws(() => config.PUBLIC_API_URL, /PUBLIC_API_URL/);
    assert.equal(config.firebaseConfigured, false);
    assert.equal(config.PUBLIC_SUPABASE_URL, undefined);
    process.env.PUBLIC_API_URL = "/v1";
    assert.equal(config.PUBLIC_API_URL, "/v1");
  } finally {
    if (original === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = original;
  }
});

test("server URLs use the current proxy target or an absolute public URL", () => {
  const originalTarget = process.env.API_PROXY_TARGET;
  const originalPublic = process.env.PUBLIC_API_URL;
  try {
    process.env.PUBLIC_API_URL = "/v1";
    delete process.env.API_PROXY_TARGET;
    assert.throws(() => config.SERVER_API_URL, /API_PROXY_TARGET/);
    process.env.API_PROXY_TARGET = "http://127.0.0.1:54321/functions/v1/api/";
    assert.equal(
      config.API_PROXY_URL,
      "http://127.0.0.1:54321/functions/v1/api/v1",
    );
    assert.equal(config.SERVER_API_URL, config.API_PROXY_URL);
    process.env.API_PROXY_TARGET = "https://example.test/functions/v1/api/v1";
    assert.equal(config.API_PROXY_URL, process.env.API_PROXY_TARGET);
    delete process.env.API_PROXY_TARGET;
    process.env.PUBLIC_API_URL = "https://api.example.test/v1/";
    assert.equal(config.SERVER_API_URL, "https://api.example.test/v1");
  } finally {
    if (originalTarget === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = originalTarget;
    if (originalPublic === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = originalPublic;
  }
});
