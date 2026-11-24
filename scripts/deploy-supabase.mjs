import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));

const functionsEnv = join(root, "apps/supabase/.env.functions");

function readSettings(path) {
  try {
    return parseEnv(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Could not read ${path}.`);
  }
}

function run(label, args, extraEnv = {}) {
  console.log(label);
  // On Windows, run pnpm's entry point directly so paths never pass through cmd.exe.
  const pnpm = process.platform === "win32" ? process.env.npm_execpath : "pnpm";

  if (!pnpm)
    throw new Error("Run this command through pnpm prod:supabase:deploy.");

  const viaNode = /\.[cm]?js$/i.test(pnpm);
  const result = spawnSync(
    viaNode ? process.execPath : pnpm,
    viaNode ? [pnpm, ...args] : args,
    {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
    },
  );

  if (result.status !== 0) throw new Error(`${label} failed.`);
}

function deploy() {
  const { SUPABASE_ACCESS_TOKEN, PROD_SUPABASE_DB_URL, PROD_SUPABASE_REF } =
    readSettings(join(root, "apps/api/.env"));

  if (
    !SUPABASE_ACCESS_TOKEN ||
    !/^[a-z0-9]{20}$/.test(PROD_SUPABASE_REF ?? "")
  ) {
    throw new Error(
      "Set SUPABASE_ACCESS_TOKEN and PROD_SUPABASE_REF in apps/api/.env.",
    );
  }

  const db = URL.parse(PROD_SUPABASE_DB_URL ?? "");

  // if (
  //   !db ||
  //   !["postgres:", "postgresql:"].includes(db.protocol) ||
  //   !db.username ||
  //   !db.password ||
  //   db.pathname.length <= 1 ||
  //   db.hash ||
  //   /%(?![0-9a-f]{2})/i.test(db.password)
  // ) {
  //   throw new Error(
  //     "Set PROD_SUPABASE_DB_URL in apps/api/.env to a PostgreSQL URI. Percent-encode reserved characters in the database password.",
  //   );
  // }

  // const direct = db.hostname === `db.${PROD_SUPABASE_REF}.supabase.co`;
  // const pooled =
  //   db.hostname.endsWith(".pooler.supabase.com") &&
  //   db.username.endsWith(`.${PROD_SUPABASE_REF}`);

  // if (!(direct || pooled) || (db.port && db.port !== "5432")) {
  //   throw new Error(
  //     "Use the direct or session pooler URI on port 5432 for PROD_SUPABASE_REF.",
  //   );
  // }

  const secrets = readSettings(functionsEnv);
  const names = Object.keys(secrets);

  // if (
  //   !names.length ||
  //   names.some(
  //     (name) =>
  //       name.startsWith("SUPABASE_") ||
  //       name === "PROD_SUPABASE_DB_URL" ||
  //       name === "PROD_SUPABASE_REF",
  //   )
  // ) {
  //   throw new Error(
  //     "Use the production function env file for runtime settings only. Supabase reserves SUPABASE_* names.",
  //   );
  // }

  if ("WEB_ORIGIN" in secrets && !secrets.WEB_ORIGIN.trim()) {
    throw new Error(
      "Set WEB_ORIGIN to the production frontend origin in apps/supabase/prod/.env.functions.",
    );
  }

  const cli = [
    "--filter",
    "@event-management/supabase",
    "exec",
    "--",
    "supabase",
  ];
  const target = [
    `--remote=${PROD_SUPABASE_REF}`,
    "--profile",
    "supabase",
    "--workdir",
    join(root, "apps"),
    "--yes",
  ];

  run("Building the Edge function", ["build:edge"]);
  run(
    "Applying Prisma migrations",
    [
      "--filter",
      "@event-management/api",
      "db:deploy",
      "--config",
      "prisma.prod.config.ts",
    ],
    { PROD_SUPABASE_DB_URL },
  );
  run(
    "Setting production function secrets",
    [...cli, "secrets", "set", "--env-file", functionsEnv, ...target],
    { SUPABASE_ACCESS_TOKEN },
  );
  run(
    "Deploying the api function",
    [...cli, "functions", "deploy", "api", "--use-docker", ...target],
    { SUPABASE_ACCESS_TOKEN },
  );
}

try {
  deploy();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
