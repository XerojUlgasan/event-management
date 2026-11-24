import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../../src/env.ts";
import { publicApiUrl } from "../../src/lib/http/request.ts";
import {
  apiProxyUrl,
  serverApiUrl,
} from "../../src/lib/server/http/api-url.ts";

test("config contains raw environment settings", () => {
  assert.equal(config.PUBLIC_API_URL, process.env.PUBLIC_API_URL);
  assert.equal(config.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_URL);
  assert.equal(config.API_PROXY_TARGET, process.env.API_PROXY_TARGET);
});

test("API URL consumers normalize URLs and report missing settings", () => {
  const original = { ...config };

  try {
    config.PUBLIC_API_URL = undefined;
    assert.throws(publicApiUrl, /PUBLIC_API_URL/);

    config.PUBLIC_API_URL = "/v1";
    config.API_PROXY_TARGET = undefined;
    assert.throws(serverApiUrl, /API_PROXY_TARGET/);

    config.API_PROXY_TARGET = "http://127.0.0.1:54321/functions/v1/api/";
    assert.equal(apiProxyUrl(), "http://127.0.0.1:54321/functions/v1/api/v1");
    assert.equal(serverApiUrl(), apiProxyUrl());

    config.API_PROXY_TARGET = "https://example.test/functions/v1/api/v1";
    assert.equal(apiProxyUrl(), config.API_PROXY_TARGET);

    config.API_PROXY_TARGET = undefined;
    config.PUBLIC_API_URL = "https://api.example.test/v1/";
    assert.equal(serverApiUrl(), "https://api.example.test/v1");
  } finally {
    Object.assign(config, original);
  }
});
