import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "vite";
import { config } from "../../src/env.ts";
import { apiBase } from "../../src/lib/http/request.ts";
import { getServerApiUrl } from "../../src/lib/server/http/api-url.ts";

async function buildClientConfig(
  context: TestContext,
  settings: NodeJS.ProcessEnv,
): Promise<typeof config> {
  const source = { ...process.env };

  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) delete source[name];
    else source[name] = value;
  }

  context.mock.property(process, "env", source);

  const result = await build({
    configFile: false,
    envFile: false,
    envPrefix: "PUBLIC_",
    logLevel: "silent",
    build: {
      lib: {
        entry: fileURLToPath(new URL("../../src/env.ts", import.meta.url)),
        formats: ["iife"],
        name: "Fixture",
      },
      write: false,
    },
  });
  assert.ok(!Array.isArray(result) || result.length === 1);
  const bundle = Array.isArray(result) ? result[0] : result;
  assert.ok("output" in bundle);
  const chunk = bundle.output[0];
  assert.equal(chunk.type, "chunk");
  assert.ok(!chunk.code.includes("server-only-fixture"));

  return runInNewContext(`${chunk.code}\nFixture.config`);
}

test("browser config contains raw Vite public values and no server settings", async (context) => {
  const browser = await buildClientConfig(context, {
    PUBLIC_API_URL: "/v1/",
    PUBLIC_FIREBASE_API_KEY: "test-key",
    PUBLIC_FIREBASE_AUTH_DOMAIN: "example.test",
    PUBLIC_FIREBASE_PROJECT_ID: "test-project",
    PUBLIC_FIREBASE_APP_ID: undefined,
    API_PROXY_TARGET: "https://server-only-fixture.invalid",
  });
  assert.equal(browser.PUBLIC_API_URL, "/v1/");
  assert.equal(browser.PUBLIC_FIREBASE_API_KEY, "test-key");
  assert.equal(browser.PUBLIC_FIREBASE_PROJECT_ID, "test-project");
  assert.equal(browser.PUBLIC_FIREBASE_APP_ID, undefined);
  assert.equal(browser.API_PROXY_TARGET, undefined);
  assert.equal(browser.SERVER_PUBLIC_API_URL, undefined);
});

test("browser config preserves an explicitly empty public API URL", async (context) => {
  const browser = await buildClientConfig(context, { PUBLIC_API_URL: "" });
  assert.equal(browser.PUBLIC_API_URL, "");
});

test("Node startup captures raw server settings and exposes the browser API default to callers", (context) => {
  const initialProxy = process.env.API_PROXY_TARGET;
  assert.equal(config.API_PROXY_TARGET, initialProxy);
  assert.equal(config.PUBLIC_API_URL, undefined);
  assert.equal(apiBase(), "http://localhost:3000/v1");
  context.mock.property(process, "env", {
    ...process.env,
    API_PROXY_TARGET: initialProxy === "fixture" ? "" : "fixture",
  });
  assert.equal(config.API_PROXY_TARGET, initialProxy);

  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(config),
  )) {
    assert.ok("value" in descriptor);
    assert.ok(
      descriptor.value === undefined || typeof descriptor.value === "string",
    );
  }
});

test("server URL resolution preserves proxy precedence", (context) => {
  context.mock.property(config, "API_PROXY_TARGET", undefined);
  context.mock.property(config, "SERVER_PUBLIC_API_URL", undefined);

  assert.equal(getServerApiUrl(), "http://127.0.0.1:3000/v1");
  config.SERVER_PUBLIC_API_URL = "/v1";
  assert.equal(getServerApiUrl(), "http://127.0.0.1:3000/v1");
  config.SERVER_PUBLIC_API_URL = "https://api.example.test/v1/";
  assert.equal(getServerApiUrl(), "https://api.example.test/v1");

  config.API_PROXY_TARGET = "http://127.0.0.1:54321/";
  assert.equal(getServerApiUrl(), "http://127.0.0.1:54321/functions/v1/api/v1");
  config.API_PROXY_TARGET = "";
  assert.equal(getServerApiUrl(), "https://api.example.test/v1");
});
