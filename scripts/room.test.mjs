import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import {
  cleanEnvironment,
  portsAvailable,
  processIdentity,
  listenerOwnedByGroup,
  serviceCommands,
  roomPlan,
  runtimeEnvironment,
  supabaseConfig,
  validateName,
} from "./room.mjs";

test("room names accept short purpose names and reject traversal, flags and nested names", () => {
  for (const name of ["test", "chat-fix", "pr45", "quotes-api"])
    assert.equal(validateName(name), name);

  for (const name of [
    "",
    "..",
    "../main",
    "/tmp/test",
    "a/b",
    ".state",
    "-test",
    "Chat",
    "chat-fix-api",
    "a".repeat(25),
    "test\n",
  ])
    assert.throws(() => validateName(name));
});

test("allocations separate every room port, browser cookie host and Docker project", () => {
  const first = roomPlan("/repo", "test", 0);
  const next = roomPlan("/repo", "chat-fix", 1);
  assert.equal(first.base, 20000);
  assert.equal(next.base, 20016);
  assert.equal(first.ip, "127.77.0.1");
  assert.notEqual(
    new URL(first.webUrl).hostname,
    new URL(next.webUrl).hostname,
  );
  assert.notEqual(new URL(first.webUrl).hostname, "127.0.0.1");
  assert.equal(new URL(first.apiUrl).hostname, new URL(first.webUrl).hostname);
  assert.equal(
    new Set([...Object.values(first.ports), ...Object.values(next.ports)]).size,
    24,
  );
  assert.notEqual(first.project, next.project);
  assert.notEqual(first.project, roomPlan("/other-repo", "test", 0).project);
  assert.deepEqual(roomPlan("/repo", "test", 0), first);
  assert.throws(() => roomPlan("/repo", "test", -1));
  assert.throws(() => roomPlan("/repo", "test", 3000));
});

test("inherited provider, database, dotenv and executable injection settings are omitted", () => {
  const result = cleanEnvironment({
    PATH: "/bin",
    HOME: "/home/user",
    DB_PASSWORD: "main-secret",
    AI_GATEWAY_API_KEY: "main-provider",
    FIREBASE_SERVICE_ACCOUNT_JSON: "main-firebase",
    NODE_OPTIONS: "--require malicious.js",
    DOTENV_CONFIG_PATH: "/main/.env",
    PUBLIC_API_URL: "https://main.example",
  });
  assert.equal(result.PATH, "/bin");
  assert.equal(result.HOME, "/home/user");
  assert.equal(result.ASTRO_DEV_BACKGROUND, "0");

  for (const name of [
    "DB_PASSWORD",
    "AI_GATEWAY_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "NODE_OPTIONS",
    "DOTENV_CONFIG_PATH",
    "PUBLIC_API_URL",
  ])
    assert.equal(result[name], undefined);
});

function localStatus(plan) {
  return {
    DB_URL: `postgresql://postgres:local-password@127.0.0.1:${plan.ports.db}/postgres`,
    API_URL: `http://127.0.0.1:${plan.ports.supabase}`,
    SERVICE_ROLE_KEY: "local-service-key",
  };
}

test("runtime targets use only CLI credentials at assigned room ports and explicit opt-in AI", () => {
  const plan = roomPlan("/repo", "test", 0);
  const env = runtimeEnvironment(
    plan,
    {
      TEXT_MODEL: "default-model",
      SEED_RANDOM_SEED: "room-seed",
      AI_GATEWAY_API_KEY: "example-must-not-be-used",
      DB_PASSWORD: "example-password",
    },
    { AI_GATEWAY_API_KEY: "opt-in-key" },
    localStatus(plan),
    {
      PATH: "/bin",
      DB_PORT: "5432",
      FIREBASE_SERVICE_ACCOUNT_JSON: "main-firebase",
    },
  );
  assert.equal(env.DB_HOST, "127.0.0.1");
  assert.equal(env.DB_PORT, String(plan.ports.db));
  assert.equal(env.DB_PASSWORD, "local-password");
  assert.equal(env.DB_NAME, "postgres");
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "local-service-key");
  assert.equal(env.STORAGE_BUCKET, "event-management");
  assert.equal(env.PUBLIC_API_URL, plan.apiUrl);
  assert.equal(env.WEB_ORIGIN, plan.webUrl);
  assert.equal(env.API_PROXY_TARGET, "");
  assert.equal(env.TEXT_MODEL, "default-model");
  assert.equal(env.SEED_RANDOM_SEED, "room-seed");
  assert.equal(env.AI_GATEWAY_API_KEY, "opt-in-key");
  assert.equal(env.DOTENV_CONFIG_PATH, "/repo/.room/.state/test/runtime.env");
  assert.equal(env.FIREBASE_SERVICE_ACCOUNT_JSON, "");
  assert.equal(env.PUBLIC_FIREBASE_API_KEY, "");
  assert.equal(
    runtimeEnvironment(plan, {}, {}, localStatus(plan), {
      AI_GATEWAY_API_KEY: "inherited",
    }).AI_GATEWAY_API_KEY,
    undefined,
  );
});

test("unsafe override names and CLI targets outside the room fail before deployment", () => {
  const plan = roomPlan("/repo", "test", 0);

  for (const name of [
    "DB_HOST",
    "DB_PORT",
    "DB_PASSWORD",
    "SUPABASE_URL",
    "PUBLIC_API_URL",
    "WEB_ORIGIN",
    "DOTENV_CONFIG_PATH",
    "NODE_OPTIONS",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
  ])
    assert.throws(
      () =>
        runtimeEnvironment(plan, {}, { [name]: "unsafe" }, localStatus(plan)),
      /Unsupported room override/,
    );

  for (const DB_URL of [
    "postgresql://postgres:password@db.example:20003/postgres",
    "postgresql://postgres:password@127.0.0.1:54322/postgres",
    "postgresql://postgres:password@127.0.0.1:20003/main",
    "postgresql://other:password@127.0.0.1:20003/postgres",
  ])
    assert.throws(
      () => runtimeEnvironment(plan, {}, {}, { ...localStatus(plan), DB_URL }),
      /outside this room/,
    );

  assert.throws(
    () =>
      runtimeEnvironment(
        plan,
        {},
        {},
        { ...localStatus(plan), API_URL: "http://127.0.0.1:54321" },
      ),
    /outside this room/,
  );
  assert.throws(
    () =>
      runtimeEnvironment(
        plan,
        {},
        {},
        { ...localStatus(plan), SERVICE_ROLE_KEY: "" },
      ),
    /credentials/,
  );
});

test("generated Supabase config keeps Storage and database features while isolating every configured port", async () => {
  const plan = roomPlan("/repo", "test", 0);
  const source = await readFile(
    new URL("../apps/supabase/config.toml", import.meta.url),
    "utf8",
  );
  const result = supabaseConfig(source, plan);
  assert.match(result, new RegExp(`project_id = "${plan.project}"`));

  for (const port of [54320, 54321, 54322, 54323, 54324, 54327, 54329, 8083])
    assert.doesNotMatch(
      result,
      new RegExp(`^\\s*\\w*port\\s*=\\s*${port}$`, "m"),
    );

  for (const port of Object.entries(plan.ports)
    .filter(([key]) => !["api", "web"].includes(key))
    .map(([, port]) => port))
    assert.match(
      result,
      new RegExp(
        `(?:port|shadow_port|inspector_port|smtp_port|pop3_port) = ${port}`,
      ),
    );

  assert.match(result, /\[storage\]\s*\nenabled = true/);
  assert.match(result, /\[storage\.buckets\.event-management\]/);
  assert.match(result, /\[db\.migrations\][\s\S]*?enabled = false/);
  assert.match(result, /\[db\.seed\][\s\S]*?enabled = false/);
  assert.match(result, /sql_paths = \[\]/);
  assert.doesNotMatch(result, /\[functions\.api\]/);
  assert.doesNotMatch(result, /entrypoint\s*=/);
  assert.match(result, new RegExp(`site_url = "${plan.webUrl}"`));
  assert.match(result, /\[edge_runtime\]\s*\nenabled = false/);
  assert.match(result, /\[analytics\]\s*\nenabled = false/);
});

test("port allocator detects an actual listener and releases failed probes", async () => {
  const listener = createServer();
  await new Promise((resolve) =>
    listener.listen({ host: "0.0.0.0", port: 0 }, resolve),
  );
  const port = listener.address().port;

  try {
    assert.equal(await portsAvailable(port, 1), false);
  } finally {
    await new Promise((resolve) => listener.close(resolve));
  }

  assert.equal(await portsAvailable(port, 1), true);
  assert.equal(await portsAvailable(port, 1), true);
});

test("process ownership includes Linux start time and boot identity", async () => {
  const identity = await processIdentity(process.pid);
  assert.equal(identity.pid, process.pid);
  assert.match(identity.started, /^\d+$/);
  assert.match(identity.boot, /^[a-f0-9-]{36}$/);
  assert.deepEqual(await processIdentity(process.pid), identity);
  assert.equal(await processIdentity(-1), null);
  assert.equal(await processIdentity(2147483647), null);
});

test("port allocator detects IPv6-only listeners needed by the Node API", async (context) => {
  const listener = createServer();

  try {
    await new Promise((resolve, reject) => {
      listener.once("error", reject);
      listener.listen({ host: "::1", ipv6Only: true, port: 0 }, resolve);
    });
  } catch (error) {
    if (["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) {
      context.skip("IPv6 is unavailable on this host");

      return;
    }

    throw error;
  }

  try {
    assert.equal(await portsAvailable(listener.address().port, 1), false);
  } finally {
    await new Promise((resolve) => listener.close(resolve));
  }
});

test("Astro resolves the planned relative config and the API command fails with its process", async () => {
  const plan = roomPlan("/repo", "test", 0);
  const commands = Object.fromEntries(await serviceCommands(plan));
  assert.deepEqual(commands.api, [
    "--filter",
    "@event-management/api",
    "start",
  ]);
  const webRoot = join(plan.path, "apps/web");
  const configArgument = commands.web[commands.web.indexOf("--config") + 1];
  const expected = join(plan.stateDir, "astro.config.mjs");
  const { resolveConfigPath } =
    await import("../apps/web/node_modules/astro/dist/core/config/config.js");

  const path = await resolveConfigPath({
    root: webRoot,
    configFile: configArgument,
    fs: { existsSync: (path) => path === expected },
  });

  assert.equal(path, expected);
});

test("rooms start a worker only when the selected revision provides its command", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clemora-room-revision-"));
  const plan = { ...roomPlan("/repo", "test", 0), path: directory };

  try {
    for (const enabled of [false, true]) {
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({
          scripts: enabled
            ? { "worker:background-jobs": "node worker.js" }
            : {},
        }),
      );
      const commands = await serviceCommands(plan);

      assert.deepEqual(
        commands.map(([name]) => name),
        enabled ? ["api", "web", "worker"] : ["api", "web"],
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  "listener ownership rejects unrelated HTTP on a planned port",
  { timeout: 10000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "clemora-room-listener-"));
    const portFile = join(directory, "listener.port");
    await writeFile(
      join(directory, "pnpm"),
      `#!${process.execPath}\nconst {createServer}=require('node:net');const {writeFileSync}=require('node:fs');const server=createServer();server.listen(0,'127.0.0.1',()=>writeFileSync(${JSON.stringify(portFile)},String(server.address().port)));\n`,
      { mode: 0o700 },
    );
    const wrapper = spawn(
      process.execPath,
      [new URL("./room.mjs", import.meta.url).pathname, "_service"],
      {
        env: {
          ...cleanEnvironment(),
          PATH: `${directory}:${process.env.PATH}`,
        },
        detached: true,
        stdio: "ignore",
      },
    );
    const foreign = createServer();
    await new Promise((resolve) =>
      foreign.listen({ host: "127.0.0.1", port: 0 }, resolve),
    );

    try {
      let port;
      const deadline = Date.now() + 5000;

      while (Date.now() < deadline) {
        try {
          port = Number(await readFile(portFile, "utf8"));
          break;
        } catch {
          await delay(25);
        }
      }

      assert.ok(port, "mock service is listening");
      const identity = await processIdentity(wrapper.pid);
      assert.equal(await listenerOwnedByGroup(port, identity), true);
      assert.equal(
        await listenerOwnedByGroup(foreign.address().port, identity),
        false,
      );
      assert.equal(
        await listenerOwnedByGroup(port, { ...identity, started: "0" }),
        false,
      );
    } finally {
      try {
        process.kill(-wrapper.pid, "SIGKILL");
      } catch {
        /* Already stopped. */
      }

      await new Promise((resolve) => foreign.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test(
  "service supervisor kills descendants after the package runner exits",
  { timeout: 10000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "clemora-room-test-"));
    const pidFile = join(directory, "descendant.pid");
    const executable = join(directory, "pnpm");
    await writeFile(
      executable,
      `#!${process.execPath}\nconst {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const child=spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)\"],{stdio:'ignore'});writeFileSync(${JSON.stringify(pidFile)},String(child.pid));setTimeout(()=>process.exit(1),200);\n`,
      { mode: 0o700 },
    );
    const wrapper = spawn(
      process.execPath,
      [new URL("./room.mjs", import.meta.url).pathname, "_service"],
      {
        env: {
          ...cleanEnvironment(),
          PATH: `${directory}:${process.env.PATH}`,
        },
        detached: true,
        stdio: "ignore",
      },
    );
    let descendant;

    try {
      const deadline = Date.now() + 5000;

      while (Date.now() < deadline) {
        try {
          descendant = Number(await readFile(pidFile, "utf8"));
          break;
        } catch {
          await delay(25);
        }
      }

      assert.ok(descendant, "mock runner spawned its descendant");

      while (
        Date.now() < deadline &&
        ((await processIdentity(wrapper.pid)) ||
          (await processIdentity(descendant)))
      )
        await delay(50);

      assert.equal(await processIdentity(wrapper.pid), null);
      assert.equal(await processIdentity(descendant), null);
    } finally {
      try {
        process.kill(-wrapper.pid, "SIGKILL");
      } catch {
        /* Already stopped. */
      }

      await rm(directory, { recursive: true, force: true });
    }
  },
);
