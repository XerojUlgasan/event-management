#!/usr/bin/env node
/**
 * Preflight for `pnpm dev`.
 *
 * Starts the local Supabase stack and creates the function env file when missing.
 * The Node API and Compose PostgreSQL stay on `pnpm all`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const isWindows = process.platform === "win32";

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.error) {
    console.error(`\n[dev] Could not run ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n[dev] ${label} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

const envFile = join(root, "apps", "supabase", ".env.functions");

if (!existsSync(envFile)) {
  writeFileSync(
    envFile,
    [
      "DB_HOST=db",
      "DB_PORT=5432",
      "DB_NAME=postgres",
      "DB_USER=postgres",
      "DB_PASSWORD=postgres",
      "WEB_ORIGIN=http://localhost:4321,http://127.0.0.1:4321",
      "",
    ].join("\n"),
  );
  console.log(
    "[dev] Created apps/supabase/.env.functions for the local Supabase database.",
  );
}

console.log("[dev] Starting the local Supabase stack…");
run("pnpm", ["supabase:start"], "Supabase CLI");
