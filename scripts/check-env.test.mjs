import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const checker = new URL("./check-env.mjs", import.meta.url);

async function checkFixture(files) {
  const root = await mkdtemp(join(tmpdir(), "clemora-env-check-"));

  try {
    for (const [path, source] of Object.entries(files)) {
      const target = join(root, path);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, source);
    }

    const result = spawnSync(
      process.execPath,
      [checker.pathname, "--root", root],
      { encoding: "utf8" },
    );

    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("allows config owners, test setup, generated bundles and config imports", async () => {
  const result = await checkFixture({
    "apps/api/src/env.ts":
      "export const config = { DB_HOST: process.env.DB_HOST };",
    "apps/web/src/env.ts":
      "export const config = { PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL };",
    "apps/api/tests/setup.ts": "process.env.DB_NAME = 'disposable';",
    "apps/api/.secrets/private.ts": "process.env.PRIVATE_FIXTURE;",
    "apps/supabase/functions/api/_generated/app.js": "process.env.DB_HOST;",
    "apps/web/src/lib/http/request.ts":
      "import { config } from '../../env'; config.PUBLIC_API_URL; // process.env is a comment",
  });
  assert.equal(result.status, 0, result.output);
});

test("rejects raw reads in app source, config, scripts and future apps", async () => {
  const result = await checkFixture({
    "apps/api/src/app.ts": "process.env.WEB_ORIGIN;",
    "apps/api/src/utils/env.ts": "process.env.DB_HOST;",
    "apps/web/src/lib/http/request.ts": "import.meta.env?.PUBLIC_API_URL;",
    "apps/web/astro.config.mjs": "process['env'].API_PROXY_TARGET;",
    "apps/api/scripts/new-script.mjs": "const { env } = process;",
    "apps/worker/index.ts": "Deno.env.get('PORT');",
    "apps/worker/other.ts": "import { env as values } from 'node:process';",
    "apps/web/src/pages/example.astro":
      "---\nconst url = import.meta.env.PUBLIC_API_URL;\n---\n<h1>Example</h1>",
  });
  assert.equal(result.status, 1, result.output);

  for (const file of [
    "src/app.ts",
    "src/utils/env.ts",
    "http/request.ts",
    "astro.config.mjs",
    "scripts/new-script.mjs",
    "worker/index.ts",
    "worker/other.ts",
    "pages/example.astro",
  ])
    assert.ok(result.output.includes(file), result.output);
});
