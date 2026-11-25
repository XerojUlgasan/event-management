#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const apiRoot = join(root, "apps/api");

const functionEnvPath = join(root, "apps/supabase/.env.functions");

// Supabase functions use container addresses; the separate Node worker uses
// the same local project's host addresses and credentials from CLI status.
export function localWorkerEnvironment(functionEnv, status, parentEnv = {}) {
  const database = new URL(status.DB_URL);
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];

  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !localHosts.includes(database.hostname)
  ) {
    throw new Error(
      "Background development worker requires local Supabase status.",
    );
  }

  const inherited = Object.fromEntries(
    Object.entries(parentEnv).filter(
      ([name]) => !name.startsWith("R2_") && name !== "S3_API_URL",
    ),
  );

  return {
    ...inherited,
    ...functionEnv,
    SUPABASE_DB_URL: status.DB_URL,
    DOTENV_CONFIG_PATH: functionEnvPath,
  };
}

function start() {
  const isWindows = process.platform === "win32";
  const status = spawnSync(
    "pnpm",
    [
      "--filter",
      "@event-management/supabase",
      "exec",
      "supabase",
      "status",
      "-o",
      "json",
    ],
    { cwd: root, encoding: "utf8", shell: isWindows },
  );

  if (status.status !== 0) {
    throw new Error(
      "Could not read local Supabase status. Start it with pnpm supabase:start.",
    );
  }

  const requireApi = createRequire(join(apiRoot, "package.json"));
  const functionEnv = requireApi("dotenv").parse(readFileSync(functionEnvPath));
  const env = localWorkerEnvironment(
    functionEnv,
    JSON.parse(status.stdout),
    process.env,
  );
  // Forward shutdown to the worker itself, without a package-manager process in between.
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "src/workers/background-jobs.ts"],
    { cwd: apiRoot, env, stdio: "inherit" },
  );

  const stop = () => child.kill("SIGTERM");

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  child.once("error", () => {
    console.error("Could not start the background development worker.");
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    process.exitCode = signal ? 0 : (code ?? 1);
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    start();
  } catch {
    console.error(
      "Could not configure the background worker. Check local Supabase and apps/supabase/.env.functions.",
    );
    process.exitCode = 1;
  }
}
