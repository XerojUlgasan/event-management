#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const functionEnvPath = join(root, "apps/supabase/.env.functions");

// Supabase functions use container addresses; the separate Node worker uses
// the same local project's host addresses and credentials from CLI status.
export function localWorkerEnvironment(functionEnv, status, parentEnv = {}) {
  const database = new URL(status.DB_URL);
  const api = new URL(status.API_URL);
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];

  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !localHosts.includes(database.hostname) ||
    !["http:", "https:"].includes(api.protocol) ||
    !localHosts.includes(api.hostname) ||
    !status.SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Background development worker requires local Supabase status.",
    );
  }

  return {
    ...parentEnv,
    ...functionEnv,
    DB_HOST: database.hostname === "[::1]" ? "::1" : database.hostname,
    DB_PORT: database.port || "5432",
    DB_NAME:
      functionEnv.DB_NAME ?? decodeURIComponent(database.pathname.slice(1)),
    DB_USER: functionEnv.DB_USER ?? decodeURIComponent(database.username),
    DB_PASSWORD:
      functionEnv.DB_PASSWORD ?? decodeURIComponent(database.password),
    SUPABASE_URL: status.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
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

  const requireApi = createRequire(join(root, "apps/api/package.json"));
  const functionEnv = requireApi("dotenv").parse(readFileSync(functionEnvPath));
  const env = localWorkerEnvironment(
    functionEnv,
    JSON.parse(status.stdout),
    process.env,
  );
  const child = spawn("pnpm", ["worker:background-jobs"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: isWindows,
  });

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
