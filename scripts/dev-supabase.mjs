#!/usr/bin/env node
/**
 * Preflight for `pnpm dev`.
 *
 * Starts the local Supabase stack and creates the function env file when missing.
 * The Node API and Compose PostgreSQL stay on `pnpm all`.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import {
  localEdgeS3Endpoint,
  localObjectStorageEnvironment,
} from "./local-object-storage.mjs";

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
      "SESSION_TTL_DAYS=7",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  console.log(
    "[dev] Created apps/supabase/.env.functions for the local Supabase database.",
  );
}

console.log("[dev] Starting the local Supabase stack…");
run("pnpm", ["supabase:start"], "Supabase CLI");

const source = readFileSync(envFile, "utf8");

const { R2_ENDPOINT } = parseEnv(source);

if (!R2_ENDPOINT || R2_ENDPOINT === localEdgeS3Endpoint) {
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

  if (status.status !== 0)
    throw new Error(
      "Could not read local Supabase status for the Edge function.",
    );

  const localStorage = localObjectStorageEnvironment(JSON.parse(status.stdout));
  const signingUrl = new URL(localEdgeS3Endpoint);

  signingUrl.port = new URL(localStorage.R2_ENDPOINT).port;

  const storage = {
    ...localStorage,
    R2_ENDPOINT: localEdgeS3Endpoint,
    R2_LOCAL_SIGNING_HOST: signingUrl.host,
  };

  const retained = source.split(/\r?\n/).filter((line) => {
    const name = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/)?.[1];

    return !name || !Object.hasOwn(storage, name);
  });

  const values = Object.entries(storage).map(
    ([name, value]) => `${name}=${JSON.stringify(value)}`,
  );

  const updated = `${retained.join("\n").trimEnd()}\n\n${values.join("\n")}\n`;

  if (updated !== source) {
    chmodSync(envFile, 0o600);
    writeFileSync(envFile, updated);
  }
}
