#!/usr/bin/env node
/**
 * Keeps the edge function server running for `pnpm dev`.
 * A runtime exit must not stop the website.
 */
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

const serveOnce = process.argv.includes("--once");

let child;
let stopping = false;

function serve() {
  child = spawn(
    "pnpm",
    [
      "--filter",
      "@event-management/supabase",
      "exec",
      "--", // Keep Node from reading Supabase's --env-file at startup.
      "supabase",
      "functions",
      "serve",
      "api",
      "--env-file",
      ".env.functions",
    ],
    {
      stdio: "inherit",
      shell: isWindows,
    },
  );
  child.on("exit", (code, signal) => {
    child = undefined;

    if (stopping) {
      process.exit(0);
    }

    if (serveOnce) {
      process.exitCode = code ?? 1;

      return;
    }

    const status = signal ? `signal ${signal}` : `exit ${code ?? 0}`;
    console.error(
      `\n[dev] Edge function server stopped (${status}). Starting it again in 2 seconds.`,
    );
    setTimeout(serve, 2000);
  });
}

function stop() {
  stopping = true;

  if (!child) process.exit(0);

  child.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
serve();
