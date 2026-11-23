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

test("allows owners, test setup, generated bundles and ordinary env utility imports", async () => {
  const result = await checkFixture({
    "apps/api/src/utils/env.ts": "export const env = process.env;",
    "apps/web/src/lib/env/env.ts":
      "export const url = import.meta.env.PUBLIC_API_URL;",
    "apps/web/src/lib/server/config/env.ts": "export const env = process.env;",
    "apps/api/tests/setup.ts": "process.env.DB_NAME = 'disposable';",
    "apps/api/.secrets/private.ts": "process.env.PRIVATE_FIXTURE;",
    "apps/supabase/functions/api/_generated/app.js": "process.env.DB_HOST;",
    "apps/web/src/lib/http/request.ts":
      "import { env } from '../env/env'; env.PUBLIC_API_URL; // process.env is a comment",
  });
  assert.equal(result.status, 0, result.output);
});

test("rejects raw reads in app source, config, scripts and future apps", async () => {
  const result = await checkFixture({
    "apps/api/src/app.ts": "process.env.WEB_ORIGIN;",
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
    "http/request.ts",
    "astro.config.mjs",
    "scripts/new-script.mjs",
    "worker/index.ts",
    "worker/other.ts",
    "pages/example.astro",
  ])
    assert.ok(result.output.includes(file), result.output);
});
