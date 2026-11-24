#!/usr/bin/env node
/**
 * One-time/pre-flight setup for `pnpm all`.
 *
 * - creates app .env files from their examples when missing
 * - starts PostgreSQL with Docker Compose and waits for its healthcheck
 * - applies any pending Prisma migrations
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
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
    console.error(`\n[setup] Could not run ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n[setup] ${label} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

for (const app of ["api", "web"]) {
  const directory = join(root, "apps", app);
  const envPath = join(directory, ".env");

  if (!existsSync(envPath)) {
    copyFileSync(join(directory, ".env.example"), envPath);
    console.log(`[setup] Created apps/${app}/.env from its example`);
  }
}

const docker = spawnSync("docker", ["--version"], {
  stdio: "ignore",
  shell: isWindows,
});

if (docker.status !== 0) {
  console.error(
    [
      "",
      "[setup] Docker is required to start PostgreSQL.",
      "        Install Docker, or start just the frontend with: pnpm dev:web",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("[setup] Starting PostgreSQL (docker compose)…");
run(
  "docker",
  [
    "compose",
    "--env-file",
    "apps/api/.env",
    "-f",
    "apps/api/compose.yaml",
    "up",
    "-d",
    "--wait",
    "db",
  ],
  "Docker Compose",
);

console.log("[setup] Applying database migrations…");
run("pnpm", ["db:deploy"], "Prisma migrate deploy");

console.log("[setup] Ready. Starting development servers…\n");
