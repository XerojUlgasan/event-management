#!/usr/bin/env node
import "./config.mjs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const [email, apiUrl = `http://localhost:${process.env.API_PORT ?? 3000}/v1`, ...extra] = process.argv.slice(2);
  if (email === "--help") return console.log("Usage: node context-factory/QA/scripts/session.mjs FIXTURE_EMAIL [LOCAL_API_BASE_URL]");
  if (extra.length || !/^(admin1|user[1-5])@gmail\.com$/.test(email ?? "")) {
    throw new Error("Choose admin1@gmail.com or user1@gmail.com through user5@gmail.com.");
  }
  const target = new URL(apiUrl);
  if (!["http:", "https:"].includes(target.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      target.username || target.password || target.search || target.hash) {
    throw new Error("Use a local API base URL, including /v1. Fixture logins are for local QA.");
  }
  const baseUrl = target.href.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "p@ssword01" }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Login returned HTTP ${response.status}. Check the API and fixture setup; no reset was performed.`);
  const profile = await response.json();
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("em_session="))?.split(";")[0];
  if (!cookie || profile.email !== email) throw new Error("Login did not return the expected fixture account and session cookie.");
  const me = await fetch(`${baseUrl}/me`, {
    headers: { Cookie: cookie }, redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!me.ok || (await me.json()).id !== profile.id) throw new Error("The new cookie did not restore the expected account.");
  const directory = await mkdtemp(join(tmpdir(), "clemora-qa-"));
  const cookieFile = join(directory, "cookie-header");
  await writeFile(cookieFile, `Cookie: ${cookie}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ email: profile.email, role: profile.role, apiUrl: baseUrl, cookieFile }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
