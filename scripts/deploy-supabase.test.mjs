import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const projectRef = "abcdefghijklmnopqrst";

const migrationUrl = `postgresql://postgres.${projectRef}:fixture%23password@aws-0-test.pooler.supabase.com:5432/postgres`;

function deploy(context, url, visionModel = "fixture-vision") {
  const root = mkdtempSync(join(tmpdir(), "amac-deploy-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "apps/api"), { recursive: true });
  mkdirSync(join(root, "apps/supabase"), { recursive: true });
  copyFileSync(
    new URL("./deploy-supabase.mjs", import.meta.url),
    join(root, "scripts/deploy-supabase.mjs"),
  );
  writeFileSync(
    join(root, "apps/api/.env"),
    [
      "SUPABASE_ACCESS_TOKEN=fixture-token",
      `PROD_SUPABASE_REF=${projectRef}`,
      `PROD_SUPABASE_DB_URL="${url}"`,
      "SUPABASE_DB_URL=postgresql://localhost/postgres",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "apps/supabase/.env.functions"),
    [
      "WEB_ORIGIN=https://frontend.example.test",
      "AI_GATEWAY_API_KEY=fixture-key",
      "TEXT_MODEL=fixture-text",
      `VISION_MODEL=${visionModel}`,
    ].join("\n"),
  );

  // Record deployment subprocesses before the deploy entrypoint imports spawnSync.
  const stub = `import childProcess from "node:child_process";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
childProcess.spawnSync = (_file, args, { env }) => {
  appendFileSync("calls.jsonl", JSON.stringify({ args, url: env.PROD_SUPABASE_DB_URL }) + "\\n");
  return { status: 0 };
};
syncBuiltinESMExports();`;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "data:text/javascript," + encodeURIComponent(stub),
      "scripts/deploy-supabase.mjs",
    ],
    {
      cwd: root,
      env: { npm_execpath: "pnpm" },
      encoding: "utf8",
    },
  );
  const trace = readFileSync(join(root, "calls.jsonl"), {
    encoding: "utf8",
    flag: "a+",
  });

  const commands = trace
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return { result, commands, root };
}

test("rejects an unparseable production URL before starting deployment", (context) => {
  const { result, commands } = deploy(
    context,
    migrationUrl.replace("%23", "#"),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PROD_SUPABASE_DB_URL.*percent-encode/i);
  assert.doesNotMatch(result.stderr, /hostname|fixture/);
  assert.deepEqual(commands, []);
});

test("rejects the transaction pooler before starting deployment", (context) => {
  const { result, commands } = deploy(
    context,
    migrationUrl.replace(":5432", ":6543"),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /session pooler.*5432/i);
  assert.deepEqual(commands, []);
});

test("rejects a missing vision model before deploying or enabling schedules", (context) => {
  const { result, commands } = deploy(context, migrationUrl, "");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set VISION_MODEL/);
  assert.deepEqual(commands, []);
});

test("activates the Edge worker schedules after deploying to the selected project", (context) => {
  const { result, commands, root } = deploy(context, migrationUrl);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(commands.length, 5);
  assert.deepEqual(commands[0].args, ["build:edge"]);
  assert.deepEqual(commands[1], {
    args: [
      "--filter",
      "@event-management/api",
      "db:deploy",
      "--config",
      "prisma.prod.config.ts",
    ],
    url: migrationUrl,
  });
  assert.ok(
    commands[2].args.includes(join(root, "apps/supabase/.env.functions")),
  );
  assert.ok(commands[2].args.includes(`--remote=${projectRef}`));
  assert.ok(commands[3].args.includes(`--remote=${projectRef}`));
  assert.ok(commands[3].args.includes("--use-docker"));
  assert.deepEqual(commands[4], {
    args: [
      "--filter",
      "@event-management/api",
      "exec",
      "tsx",
      "scripts/schedule-edge-workers.ts",
    ],
    url: migrationUrl,
  });
});
