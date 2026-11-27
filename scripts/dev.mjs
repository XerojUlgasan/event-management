#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createSocket } from "node:dgram";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const edgeOnly = process.argv.includes("--edge-only");

const isWindows = process.platform === "win32";

const exec = isWindows ? "" : "exec ";

const stackCommand = [
  "node scripts/dev-supabase.mjs",
  "pnpm build:edge",
  `${exec}concurrently --names edge,web,jobs --prefix-colors blue,green,magenta "node scripts/dev-edge.mjs" "cross-env PUBLIC_API_URL=/v1 API_PROXY_TARGET=http://127.0.0.1:54321 ASTRO_DEV_BACKGROUND=0 pnpm dev:web" "node scripts/dev-background-jobs.mjs"`,
].join(" && ");

// The Supabase gateway uses TCP. Claim UDP on the same loopback port for the
// lifetime of this command so competing sessions cannot replace its container.
const lock = createSocket("udp4");

lock.once("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "[dev] AMAC Edge is already managed by another dev session. Stop that session before starting a new one."
      : `[dev] Could not claim the local Edge runtime: ${error.message}`,
  );
  process.exitCode = 1;
  lock.close();
});

lock.bind({ address: "127.0.0.1", port: 54321, exclusive: true }, () => {
  const child = spawn(
    edgeOnly ? `${exec}node scripts/dev-edge.mjs --once` : stackCommand,
    {
      cwd: root,
      detached: !isWindows,
      shell: true,
      stdio: "inherit",
    },
  );

  function stop() {
    if (!child.pid) return;

    // Terminate the whole command tree, including pnpm's shell and CLI children.
    if (isWindows) {
      child.kill("SIGTERM");

      return;
    }

    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  if (!isWindows) process.on("SIGHUP", stop);

  child.once("error", (error) => {
    console.error(`[dev] Could not start the dev command: ${error.message}`);
  });
  child.once("close", (code) => {
    process.exitCode = code ?? 1;
    lock.close();
  });
});
