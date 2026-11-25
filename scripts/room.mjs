#!/usr/bin/env node
/** Isolated, persistent local test rooms. Runtime state and secrets stay in .room/.state. */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const runner = fileURLToPath(import.meta.url);

const blockSize = 16;
const firstPort = 20000;

const requiredR2Settings = [
  "S3_API_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

const r2OverrideNames = [
  ...requiredR2Settings,
  "R2_OBJECT_PREFIX",
];

const overrideNames = new Set([
  "AI_GATEWAY_API_KEY",
  "TEXT_MODEL",
  "VISION_MODEL",
  "DECISION_MODEL",
  "EMBEDDING_MODEL",
  ...r2OverrideNames,
]);

function validateOverrides(overrides, roomName) {
  for (const name of Object.keys(overrides)) {
    if (!overrideNames.has(name))
      throw new Error(`Unsupported room override: ${name}.`);
  }

  for (const name of requiredR2Settings) {
    if (!overrides[name]?.trim())
      throw new Error(`Missing R2 room override: ${name}.`);
  }

  const prefix = overrides.R2_OBJECT_PREFIX?.trim() ?? "";
  if (
    !prefix.startsWith(`test-rooms/${roomName}/`) ||
    !/^[\w-]+(?:\/[\w-]+)*$/.test(prefix)
  )
    throw new Error(
      "R2 room overrides require R2_OBJECT_PREFIX=test-rooms/<room>/<unique-id>.",
    );
}

export function validateName(name) {
  if (
    typeof name !== "string" ||
    name.length > 24 ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)?$/.test(name)
  ) {
    throw new Error(
      "Room names must be one or two lowercase words, at most 24 characters (for example test or chat-fix).",
    );
  }

  return name;
}

export function roomPlan(primary, name, slot) {
  validateName(name);

  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    firstPort + slot * blockSize + blockSize > 64000
  )
    throw new Error("Invalid room port allocation.");

  const base = firstPort + slot * blockSize;
  const ip = `127.77.${Math.floor(slot / 250)}.${(slot % 250) + 1}`;
  const hash = createHash("sha256").update(primary).digest("hex").slice(0, 10);

  const ports = Object.fromEntries(
    [
      "api",
      "web",
      "supabase",
      "db",
      "shadow",
      "studio",
      "mail",
      "smtp",
      "pop3",
      "analytics",
      "inspector",
      "pooler",
    ].map((name, index) => [name, base + index]),
  );

  return {
    version: 1,
    name,
    primary,
    slot,
    base,
    ip,
    ports,
    path: join(primary, ".room", name),
    stateDir: join(primary, ".room", ".state", name),
    project: `room-${hash}-${name}`,
    webUrl: `http://${ip}:${ports.web}`,
    apiUrl: `http://${ip}:${ports.api}/v1`,
  };
}

/** Deliberately allowlist OS settings: inherited app, Firebase, Node and DB secrets never enter a room. */
export function cleanEnvironment(source = process.env) {
  const result = {};

  for (const name of [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "PNPM_HOME",
    "COREPACK_HOME",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_CONFIG",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ]) {
    if (source[name] !== undefined) result[name] = source[name];
  }

  return {
    ...result,
    CI: "true",
    HUSKY: "0",
    ASTRO_DEV_BACKGROUND: "0",
    NO_COLOR: "1",
  };
}

export function runtimeEnvironment(
  plan,
  defaults,
  overrides,
  status,
  os = process.env,
) {
  validateOverrides(overrides, plan.name);

  const db = new URL(status.DB_URL);
  const api = new URL(status.API_URL);

  if (
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    Number(db.port) !== plan.ports.db ||
    db.pathname !== "/postgres" ||
    db.username !== "postgres"
  )
    throw new Error("Supabase reported a database outside this room.");

  if (
    !["localhost", "127.0.0.1"].includes(api.hostname) ||
    Number(api.port) !== plan.ports.supabase ||
    api.protocol !== "http:"
  )
    throw new Error("Supabase reported an API outside this room.");

  if (!db.password)
    throw new Error("Supabase did not report local database credentials.");

  const values = {};

  for (const name of [
    "SESSION_TTL_DAYS",
    "TEXT_MODEL",
    "VISION_MODEL",
    "DECISION_MODEL",
    "EMBEDDING_MODEL",
  ]) {
    if (defaults[name] !== undefined) values[name] = defaults[name];
  }

  return {
    ...cleanEnvironment(os),
    ...values,
    ...overrides,
    SUPABASE_DB_URL: `postgresql://postgres:${db.password}@127.0.0.1:${plan.ports.db}/postgres`,
    // Older room revisions and integration fixtures still read the split settings.
    DB_HOST: "127.0.0.1",
    DB_PORT: String(plan.ports.db),
    DB_NAME: "postgres",
    DB_USER: "postgres",
    DB_PASSWORD: decodeURIComponent(db.password),
    API_PORT: String(plan.ports.api),
    WEB_ORIGIN: plan.webUrl,
    PUBLIC_API_URL: plan.apiUrl,
    API_PROXY_TARGET: "",
    NODE_ENV: "development",
    FIREBASE_PROJECT_ID: "",
    FIREBASE_CLIENT_EMAIL: "",
    FIREBASE_PRIVATE_KEY: "",
    GOOGLE_APPLICATION_CREDENTIALS: "",
    FIREBASE_AUTH_EMULATOR_HOST: "",
    GOOGLE_CLOUD_PROJECT: "",
    GCLOUD_PROJECT: "",
    PUBLIC_FIREBASE_API_KEY: "",
    PUBLIC_FIREBASE_AUTH_DOMAIN: "",
    PUBLIC_FIREBASE_PROJECT_ID: "",
    PUBLIC_FIREBASE_STORAGE_BUCKET: "",
    PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
    PUBLIC_FIREBASE_APP_ID: "",
    DOTENV_CONFIG_PATH: join(plan.stateDir, "runtime.env"),
    DOTENV_CONFIG_OVERRIDE: "false",
    DOTENV_CONFIG_QUIET: "true",
    ASTRO_DEV_BACKGROUND: "0",
  };
}

export function supabaseConfig(source, plan) {
  const edits = {
    "": { project_id: JSON.stringify(plan.project) },
    api: { port: plan.ports.supabase },
    db: { port: plan.ports.db, shadow_port: plan.ports.shadow },
    "db.pooler": { port: plan.ports.pooler },
    "db.migrations": { enabled: false },
    "db.seed": { enabled: false, sql_paths: "[]" },
    realtime: { enabled: false },
    studio: {
      port: plan.ports.studio,
      api_url: JSON.stringify(`http://127.0.0.1:${plan.ports.supabase}`),
      openai_api_key: '""',
    },
    local_smtp: {
      enabled: false,
      port: plan.ports.mail,
      smtp_port: plan.ports.smtp,
      pop3_port: plan.ports.pop3,
    },
    storage: { enabled: false },
    auth: {
      enabled: true,
      site_url: JSON.stringify(plan.webUrl),
      additional_redirect_urls: JSON.stringify([plan.webUrl]),
    },
    edge_runtime: { enabled: false, inspector_port: plan.ports.inspector },
    analytics: { enabled: false, port: plan.ports.analytics },
  };
  let section = "";
  const seen = new Set();
  const output = [];
  function finish() {
    for (const [key, value] of Object.entries(edits[section] || {})) {
      if (!seen.has(`${section}:${key}`)) output.push(`${key} = ${value}`);
    }
  }

  for (const line of source.split("\n")) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);

    if (header) {
      finish();
      section = header[1];
    }

    // Node serves the API. No Edge entrypoint or selected checkout's private env is used.
    if (section.startsWith("functions.")) continue;

    const entry = line.match(/^\s*([\w-]+)\s*=/);

    if (entry && Object.hasOwn(edits[section] || {}, entry[1])) {
      seen.add(`${section}:${entry[1]}`);
      output.push(`${entry[1]} = ${edits[section][entry[1]]}`);
    } else output.push(line);
  }

  finish();

  return output.join("\n");
}

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: cleanEnvironment(),
  });

  if (result.status !== 0)
    throw new Error(
      "Git command failed; confirm the revision and worktree registration.",
    );

  return result.stdout.trim();
}

async function primaryRoot() {
  const records = git(process.cwd(), ["worktree", "list", "--porcelain", "-z"]);

  const root = records
    .split("\0")
    .find((line) => line.startsWith("worktree "))
    ?.slice(9);

  if (!root) throw new Error("Cannot locate the primary Git worktree.");

  return realpath(root);
}

async function ensureDirectory(path) {
  try {
    if ((await lstat(path)).isSymbolicLink())
      throw new Error(`Refusing symbolic-link directory: ${path}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    await mkdir(path, { mode: 0o700 });
  }

  if (!(await lstat(path)).isDirectory())
    throw new Error(`Expected directory: ${path}`);
}

async function json(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;

    throw error;
  }
}

async function privateWrite(path, value) {
  await writeFile(path, value, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function atomicJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await privateWrite(temporary, JSON.stringify(value, null, 2) + "\n");
  await rename(temporary, path);
}

// Linux process start time makes stale PID files safe even after PID reuse.
export async function processIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return null;

  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");

    if (fields[0] === "Z") return null;

    return {
      pid,
      started: fields[19],
      boot: (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim(),
    };
  } catch {
    return null;
  }
}

async function alive(identity) {
  const current = identity && (await processIdentity(identity.pid));

  return Boolean(
    current &&
    current.started === identity.started &&
    current.boot === identity.boot,
  );
}

async function signalOwned(identity, signal = "SIGTERM") {
  if (!(await alive(identity))) return false;

  try {
    process.kill(-identity.pid, signal);

    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;

    throw error;
  }
}

/** HTTP alone is insufficient: the assigned listener must belong to this room's live group. */
export async function listenerOwnedByGroup(port, identity) {
  if (!(await alive(identity))) return false;

  const sockets = new Set();

  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let table;

    try {
      table = await readFile(path, "utf8");
    } catch {
      continue;
    }

    for (const line of table.split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);

      if (
        fields[3] === "0A" &&
        Number.parseInt(fields[1]?.split(":")[1], 16) === port
      )
        sockets.add(`socket:[${fields[9]}]`);
    }
  }

  if (!sockets.size) return false;

  for (const entry of await readdir("/proc", { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;

    try {
      const stat = await readFile(`/proc/${entry.name}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");

      if (Number(fields[2]) !== identity.pid) continue;

      const directory = `/proc/${entry.name}/fd`;
      const descriptors = await readdir(directory);

      const links = await Promise.allSettled(
        descriptors.map((descriptor) => readlink(join(directory, descriptor))),
      );

      if (
        links.some(
          (link) => link.status === "fulfilled" && sockets.has(link.value),
        )
      )
        return await alive(identity);
    } catch {
      /* A room descendant can exit during inspection. */
    }
  }

  return false;
}

async function withLock(path, action) {
  // flock releases on exit/crash and avoids stale-file deletion races between allocators.
  const handle = await open(path, "a", 0o600);
  await handle.chmod(0o600);
  await handle.close();
  const child = spawn(
    "flock",
    [
      "--exclusive",
      "--wait",
      "30",
      path,
      process.execPath,
      "--eval",
      "process.stdout.write('locked'); process.stdin.resume();",
    ],
    { env: cleanEnvironment(), stdio: ["pipe", "pipe", "ignore"] },
  );
  await new Promise((resolve, reject) => {
    child.once("error", () =>
      reject(new Error("Linux flock is required for safe room operations.")),
    );
    child.once("exit", () =>
      reject(new Error(`Room operation is busy: ${path}`)),
    );
    child.stdout.once("data", resolve);
  });

  try {
    return await action();
  } finally {
    child.stdin.end();
  }
}

export async function portsAvailable(base, size = blockSize) {
  const servers = [];

  try {
    for (let port = base; port < base + size; port++) {
      const server = createServer();
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "0.0.0.0", port, exclusive: true }, resolve);
      });
      const ipv6 = createServer();
      servers.push(ipv6);

      try {
        await new Promise((resolve, reject) => {
          ipv6.once("error", reject);
          ipv6.listen(
            { host: "::", ipv6Only: true, port, exclusive: true },
            resolve,
          );
        });
      } catch (error) {
        if (!["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code))
          throw error;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(resolve))),
    );
  }
}

async function stateRoot(primary) {
  if (process.platform !== "linux")
    throw new Error("Room process ownership currently requires Linux /proc.");

  await ensureDirectory(join(primary, ".room"));
  await ensureDirectory(join(primary, ".room", ".state"));
  await chmod(join(primary, ".room", ".state"), 0o700);

  return join(primary, ".room", ".state");
}

async function allocation(primary, name) {
  const directory = await stateRoot(primary);

  return withLock(join(directory, ".allocate.lock"), async () => {
    await ensureDirectory(join(directory, name));
    const path = join(directory, name, "room.json");
    const existing = await json(path);

    if (existing) {
      const expected = roomPlan(primary, name, existing.slot);

      if (JSON.stringify(existing) !== JSON.stringify(expected))
        throw new Error("Room allocation has unexpected ownership or paths.");

      return existing;
    }

    const used = new Set();

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const manifest = await json(join(directory, entry.name, "room.json"));

      if (manifest) used.add(manifest.slot);
    }

    for (let slot = 0; slot < 2750; slot++) {
      if (
        used.has(slot) ||
        !(await portsAvailable(firstPort + slot * blockSize))
      )
        continue;

      const plan = roomPlan(primary, name, slot);
      await atomicJson(path, plan);

      return plan;
    }

    throw new Error("No unused port block is available for this room.");
  });
}

async function verifyWorktree(plan) {
  if (
    (await lstat(plan.path)).isSymbolicLink() ||
    (await realpath(plan.path)) !== plan.path
  )
    throw new Error("Refusing a symbolic-link room worktree.");

  const registered = git(plan.primary, [
    "worktree",
    "list",
    "--porcelain",
    "-z",
  ])
    .split("\0")
    .includes(`worktree ${plan.path}`);

  if (
    !registered ||
    git(plan.path, ["rev-parse", "--show-toplevel"]) !== plan.path
  )
    throw new Error("Room is not a registered worktree of this repository.");

  return git(plan.path, ["rev-parse", "HEAD"]);
}

function statePath(plan) {
  return join(plan.stateDir, "runtime.json");
}

function logPath(plan, name) {
  return join(plan.stateDir, `${name}.log`);
}

async function appendLog(plan, name) {
  const handle = await open(logPath(plan, name), "a", 0o600);
  await handle.chmod(0o600);

  return handle;
}

async function runPrivate(
  plan,
  command,
  args,
  env,
  label,
  active,
  track = async () => {},
) {
  const log = await appendLog(plan, label);
  let stdout = "";
  const child = spawn(command, args, {
    cwd: plan.path,
    env,
    detached: true,
    stdio: ["ignore", "pipe", log.fd],
  });
  child.stdout.on("data", (data) => {
    stdout += data.toString();
    log.write(data).catch(() => {});
  });

  const completion = new Promise((resolve, reject) => {
    child.once("error", () =>
      reject(
        new Error(`${label} could not start. See ${logPath(plan, label)}`),
      ),
    );
    child.once("exit", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${label} failed. See ${logPath(plan, label)}`)),
    );
  });

  // Attach handlers before awaiting process metadata, including spawn failures.
  completion.catch(() => {});
  const identity = await processIdentity(child.pid);

  if (identity) active.add(identity);

  await track(identity ? [identity] : []);

  const timeout = setTimeout(
    () => {
      signalOwned(identity, "SIGKILL").catch(() => {});
    },
    15 * 60 * 1000,
  );

  try {
    return await completion;
  } finally {
    clearTimeout(timeout);

    if (identity) active.delete(identity);

    await track([]);
    await log.close();
  }
}

function supabaseArgs(plan, command) {
  return [
    "--dir",
    join(plan.path, "apps/supabase"),
    "exec",
    "supabase",
    "--workdir",
    join(plan.stateDir, "project"),
    command,
    ...(command === "status" ? ["-o", "json"] : []),
  ];
}

async function httpOk(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(5000) })).ok;
  } catch {
    return false;
  }
}

async function readiness(plan, state) {
  return (
    state.phase === "ready" &&
    (await alive(state.supervisor)) &&
    state.children?.length === (await serviceCommands(plan)).length &&
    (await Promise.all(state.children.map(alive))).every(Boolean) &&
    (
      await Promise.all([
        listenerOwnedByGroup(plan.ports.api, state.children[0]),
        listenerOwnedByGroup(plan.ports.web, state.children[1]),
      ])
    ).every(Boolean) &&
    (
      await Promise.all([httpOk(`${plan.apiUrl}/health`), httpOk(plan.webUrl)])
    ).every(Boolean)
  );
}

async function seedSmoke(plan, env, require) {
  const context = await readFile(
    join(plan.path, "apps/api/src/db/seed/context.ts"),
    "utf8",
  );
  const seed = await readFile(
    join(plan.path, "apps/api/src/db/seed.ts"),
    "utf8",
  );
  const password = context.match(
    /export const LOCAL_PASSWORD\s*=\s*"([^"\n]+)"/,
  )?.[1];
  const email = seed.match(/email:\s*"(admin[^"\n]+)"/)?.[1];

  if (!password || !email)
    throw new Error(
      "Cannot discover this revision's seeded admin fixture for the readiness check.",
    );

  const { Client } = require("pg");
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  await client.connect();

  try {
    const vector = await client.query(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'",
    );

    if (vector.rowCount !== 1)
      throw new Error("Room database is missing pgvector.");

    const migrations = await client.query(
      'SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );

    if (!migrations.rows[0]?.count)
      throw new Error("Room database has no deployed application migrations.");
  } finally {
    await client.end();
  }

  const response = await fetch(`${plan.apiUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: plan.webUrl },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  const profile = response.ok && (await response.json());
  const cookie = response.headers.get("set-cookie")?.split(";")[0];

  if (
    !profile ||
    profile.role !== "admin" ||
    !cookie?.startsWith("em_session=")
  )
    throw new Error(
      "Seeded admin login did not pass the room readiness check.",
    );

  try {
    for (const path of ["me", "packages", "services"]) {
      const result = await fetch(`${plan.apiUrl}/${path}`, {
        headers: { cookie, origin: plan.webUrl },
        signal: AbortSignal.timeout(15000),
      });

      if (!result.ok)
        throw new Error(`Room readiness check failed for ${path}.`);

      if (path !== "packages") {
        await result.body?.cancel();
        continue;
      }

      const page = await result.json();
      const packages = Array.isArray(page) ? page : (page.packages ?? []);
      const mediaUrl = packages.find(({ imageUrl }) =>
        /^\/v1\/catalog-media\/[\w-]+$/.test(imageUrl ?? ""),
      )?.imageUrl;

      if (mediaUrl) {
        const image = await fetch(new URL(mediaUrl, plan.apiUrl), {
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });

        if (!image.ok || !(await image.arrayBuffer()).byteLength)
          throw new Error(
            "Room readiness could not read a stored package image. Check the storage bucket and object prefix.",
          );
      }
    }
  } finally {
    await fetch(`${plan.apiUrl}/auth/logout`, {
      method: "POST",
      headers: { cookie, origin: plan.webUrl },
      signal: AbortSignal.timeout(15000),
    });
  }
}

export async function serviceCommands(
  plan,
  config = join(plan.stateDir, "astro.config.mjs"),
) {
  const manifest = await json(join(plan.path, "package.json"));

  return [
    // tsx watch stays alive after EADDRINUSE; the existing start script fails with the process.
    ["api", ["--filter", "@event-management/api", "start"]],
    [
      "web",
      [
        "--dir",
        join(plan.path, "apps/web"),
        "exec",
        "astro",
        "dev",
        "--config",
        relative(join(plan.path, "apps/web"), config),
        "--host",
        plan.ip,
        "--port",
        String(plan.ports.web),
      ],
    ],
    ...(manifest?.scripts?.["worker:background-jobs"]
      ? [["worker", ["worker:background-jobs"]]]
      : []),
  ];
}

/** Keep a verified group leader alive until every service descendant has been terminated. */
function serviceProcess(args) {
  let stopping = false;
  function finish() {
    if (stopping) return;

    stopping = true;

    // This wrapper handles SIGTERM, while pnpm and its descendants receive it normally.
    try {
      process.kill(-process.pid, "SIGTERM");
    } catch {
      /* Group already exited. */
    }

    setTimeout(() => {
      try {
        process.kill(-process.pid, "SIGKILL");
      } catch {
        process.exit(1);
      }
    }, 1000);
  }
  process.on("SIGTERM", finish);
  process.on("SIGINT", finish);
  const child = spawn("pnpm", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  child.once("error", finish);
  child.once("exit", finish);
}

async function supervise(plan, token) {
  const active = new Set();
  const children = [];
  let stopping = false;
  let state = await json(statePath(plan));
  const launchDeadline = Date.now() + 10000;

  while (
    state?.token === token &&
    !state.supervisor &&
    Date.now() < launchDeadline
  ) {
    await delay(50);
    state = await json(statePath(plan));
  }

  if (state?.token !== token)
    throw new Error("Supervisor launch no longer owns this room.");

  async function update(patch) {
    state = { ...state, ...patch, updatedAt: new Date().toISOString() };
    await atomicJson(statePath(plan), state);
  }
  async function cleanup() {
    await Promise.all([...active].map((identity) => signalOwned(identity)));
    await delay(1000);
    await Promise.all(
      [...active].map((identity) => signalOwned(identity, "SIGKILL")),
    );
  }

  const stop = () => {
    stopping = true;
    cleanup().catch(() => {});
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  function assertRunning() {
    if (stopping) throw new Error("Room startup was stopped.");
  }

  const run = async (args, env, label) => {
    assertRunning();

    const result = await runPrivate(
      plan,
      "pnpm",
      args,
      env,
      label,
      active,
      async (preparing) => {
        if (stopping)
          await Promise.all(preparing.map((identity) => signalOwned(identity)));

        await update({ preparing });
      },
    );

    assertRunning();

    return result;
  };

  try {
    await update({
      supervisor: await processIdentity(process.pid),
      phase: "starting",
      stage: "installing dependencies",
      children: [],
    });
    await run(["install", "--frozen-lockfile"], cleanEnvironment(), "install");
    const require = createRequire(join(plan.path, "apps/api/package.json"));
    const dotenv = require("dotenv");
    const defaults = {
      ...dotenv.parse(await readFile(join(plan.path, "apps/api/.env.example"))),
      ...dotenv.parse(await readFile(join(plan.path, "apps/web/.env.example"))),
    };
    let overrides = {};

    try {
      overrides = dotenv.parse(
        await readFile(join(plan.stateDir, "overrides.env")),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    // Reject unsafe overrides before any database work.
    validateOverrides(overrides, plan.name);

    await ensureDirectory(join(plan.stateDir, "project"));
    await ensureDirectory(join(plan.stateDir, "project/supabase"));
    await privateWrite(
      join(plan.stateDir, "project/supabase/config.toml"),
      supabaseConfig(
        await readFile(join(plan.path, "apps/supabase/config.toml"), "utf8"),
        plan,
      ),
    );
    await update({ stage: "starting isolated Supabase" });
    await run(
      supabaseArgs(plan, "start"),
      cleanEnvironment(),
      "supabase-start",
    );
    const status = JSON.parse(
      await run(
        supabaseArgs(plan, "status"),
        cleanEnvironment(),
        "supabase-status",
      ),
    );
    const env = runtimeEnvironment(plan, defaults, overrides, status);
    const baseRuntimeEnv = { ...env };
    for (const name of r2OverrideNames) delete baseRuntimeEnv[name];
    await privateWrite(
      env.DOTENV_CONFIG_PATH,
      Object.entries(baseRuntimeEnv)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join("\n") + "\n",
    );
    await update({
      stage: "deploying migrations",
      ai: Boolean(env.AI_GATEWAY_API_KEY),
    });
    await run(["db:deploy"], baseRuntimeEnv, "migrations");
    await update({ stage: "seeding isolated database" });
    await run(["db:seed"], env, "seed");
    const config = join(plan.stateDir, "astro.config.mjs");
    await privateWrite(
      config,
      `import config from ${JSON.stringify(pathToFileURL(join(plan.path, "apps/web/astro.config.mjs")).href)};\nexport default {...config, server:{...config.server,host:${JSON.stringify(plan.ip)},port:${plan.ports.web}},vite:{...config.vite,envDir:${JSON.stringify(plan.stateDir)},server:{...config.vite?.server,strictPort:true}}};\n`,
    );
    await update({ stage: "starting room application services" });
    const exits = [];

    for (const [label, args] of await serviceCommands(plan, config)) {
      assertRunning();
      const log = await appendLog(plan, label);
      const child = spawn(process.execPath, [runner, "_service", ...args], {
        cwd: plan.path,
        env: label === "web" ? baseRuntimeEnv : env,
        detached: true,
        stdio: ["ignore", log.fd, log.fd],
      });
      child.once("error", () => exits.push(label));
      child.once("exit", () => exits.push(label));
      const identity = await processIdentity(child.pid);
      await log.close();

      if (!identity)
        throw new Error(
          `${label} failed to start. See ${logPath(plan, label)}`,
        );

      active.add(identity);
      children.push(identity);

      if (stopping) await signalOwned(identity);

      await update({ children });
    }

    const deadline = Date.now() + 180000;

    while (true) {
      assertRunning();

      if (exits.length)
        throw new Error(
          `Room service exited: ${exits.join(", ")}. See private service logs.`,
        );

      if (
        (
          await Promise.all([
            httpOk(`${plan.apiUrl}/health`),
            httpOk(plan.webUrl),
            listenerOwnedByGroup(plan.ports.api, children[0]),
            listenerOwnedByGroup(plan.ports.web, children[1]),
          ])
        ).every(Boolean)
      )
        break;

      if (Date.now() > deadline)
        throw new Error(
          "API or website did not become available on its assigned room URL.",
        );

      await delay(1000);
    }

    await update({ stage: "checking database, seed login and catalog" });
    await seedSmoke(plan, env, require);
    // Do not declare readiness while a service failed during the smoke check.
    assertRunning();

    if (
      exits.length ||
      !(await Promise.all(children.map(alive))).every(Boolean) ||
      !(
        await Promise.all([
          listenerOwnedByGroup(plan.ports.api, children[0]),
          listenerOwnedByGroup(plan.ports.web, children[1]),
        ])
      ).every(Boolean)
    )
      throw new Error("A room service exited during readiness checks.");

    await update({
      phase: "ready",
      stage: "ready",
      checkedAt: new Date().toISOString(),
    });

    while (!stopping) {
      await delay(2000);

      if (
        exits.length ||
        !(await Promise.all(children.map(alive))).every(Boolean)
      )
        throw new Error("A room service exited. See private service logs.");
    }

    await cleanup();
    await update({
      phase: "stopped",
      stage: "application services stopped",
      children: [],
    });
  } catch (error) {
    await cleanup();
    // Exception details can contain connection strings; keep them only in the private supervisor log.
    console.error(error);
    await update({
      phase: stopping ? "stopped" : "failed",
      stage: stopping
        ? "application services stopped"
        : "startup or runtime failed; see private logs",
      children: [],
    });
  }
}

async function startRoom(plan) {
  const commit = await verifyWorktree(plan);
  let token;
  await withLock(join(plan.stateDir, ".operation.lock"), async () => {
    const state = await json(statePath(plan));

    if (state && (await alive(state.supervisor))) {
      if (["starting", "ready"].includes(state.phase)) {
        token = state.token;

        return;
      }

      throw new Error(
        "Room supervisor is still stopping; retry after it exits.",
      );
    }

    // Clean up only recorded live owners after an interrupted supervisor.
    const previous = [...(state?.children || []), ...(state?.preparing || [])];

    if (previous.length) {
      await Promise.all(previous.map((identity) => signalOwned(identity)));
      await delay(1200);
      await Promise.all(
        previous.map((identity) => signalOwned(identity, "SIGKILL")),
      );
    }

    if (!(await portsAvailable(plan.ports.api, 2)))
      throw new Error(
        "A room application port is already occupied. Stop its owner before starting this room.",
      );

    token = randomUUID();
    await atomicJson(statePath(plan), {
      token,
      commit,
      phase: "starting",
      stage: "launching supervisor",
      children: [],
      updatedAt: new Date().toISOString(),
    });
    const log = await appendLog(plan, "supervisor");
    const child = spawn(
      process.execPath,
      [runner, "_supervise", plan.primary, plan.name, token],
      {
        cwd: plan.primary,
        env: cleanEnvironment(),
        detached: true,
        stdio: ["ignore", log.fd, log.fd],
      },
    );
    const identity = await processIdentity(child.pid);
    await log.close();
    child.unref();

    if (!identity) throw new Error("Could not launch room supervisor.");

    // The supervisor waits for this registration before taking ownership of state writes.
    const latest = await json(statePath(plan));

    if (latest.token === token)
      await atomicJson(statePath(plan), { ...latest, supervisor: identity });
  });
  let announced = "";

  while (true) {
    const state = await json(statePath(plan));

    if (!state || state.token !== token)
      throw new Error("Room startup was superseded or stopped.");

    if (state.stage !== announced) {
      console.log(`[room:${plan.name}] ${state.stage}`);
      announced = state.stage;
    }

    if (state.phase === "ready") {
      if (!(await readiness(plan, state)))
        throw new Error(
          `Room did not pass current readiness checks. Private logs: ${plan.stateDir}`,
        );

      await printStatus(plan);

      return;
    }

    if (
      ["failed", "stopped"].includes(state.phase) ||
      (state.supervisor && !(await alive(state.supervisor)))
    )
      throw new Error(
        `Room is ${state.phase === "starting" ? "interrupted" : state.phase}. Private logs: ${plan.stateDir}`,
      );

    await delay(1000);
  }
}

async function stopRoom(plan) {
  await verifyWorktree(plan);
  await withLock(join(plan.stateDir, ".operation.lock"), async () => {
    const state = await json(statePath(plan));

    if (state?.supervisor && (await alive(state.supervisor))) {
      await signalOwned(state.supervisor);
      const deadline = Date.now() + 15000;

      while ((await alive(state.supervisor)) && Date.now() < deadline)
        await delay(200);

      await signalOwned(state.supervisor, "SIGKILL");
    }

    for (const identity of [
      ...(state?.children || []),
      ...(state?.preparing || []),
    ]) {
      await signalOwned(identity);
      await delay(200);
      await signalOwned(identity, "SIGKILL");
    }

    const active = new Set();
    await runPrivate(
      plan,
      "pnpm",
      [...supabaseArgs(plan, "stop"), "--project-id", plan.project],
      cleanEnvironment(),
      "supabase-stop",
      active,
    );
    await atomicJson(statePath(plan), {
      ...state,
      phase: "stopped",
      stage: "stopped; worktree and database preserved",
      children: [],
      supervisor: null,
      updatedAt: new Date().toISOString(),
    });
  });
  await printStatus(plan);
}

async function printStatus(plan) {
  const state = await json(statePath(plan));
  let phase = state?.phase || "unprepared";

  if (phase === "ready" && !(await readiness(plan, state))) phase = "unhealthy";

  if (
    phase === "starting" &&
    state.supervisor &&
    !(await alive(state.supervisor))
  )
    phase = "interrupted";

  let commit = state?.commit || null;

  try {
    commit = await verifyWorktree(plan);
  } catch {
    phase = "worktree unavailable";
  }

  console.log(
    JSON.stringify(
      {
        name: plan.name,
        state: phase,
        stage: state?.stage,
        path: plan.path,
        commit,
        web: plan.webUrl,
        api: plan.apiUrl,
        studio: `http://127.0.0.1:${plan.ports.studio}`,
        ports: plan.ports,
        project: plan.project,
        ai: state?.ai
          ? "configured in room overrides"
          : "unavailable (no room provider key)",
        logs: plan.stateDir,
      },
      null,
      2,
    ),
  );
}

export async function main(args = process.argv.slice(2)) {
  const [command, name, revision] = args;

  if (command === "_service") {
    serviceProcess(args.slice(1));

    return;
  }

  if (command === "_supervise") {
    const primary = await realpath(name);
    const plan = await allocation(primary, validateName(revision));
    await verifyWorktree(plan);
    await supervise(plan, args[3]);

    return;
  }

  if (
    !["create", "start", "stop", "status", "list"].includes(command) ||
    (command === "list"
      ? args.length !== 1
      : args.length < 2 || args.length > (command === "create" ? 3 : 2))
  )
    throw new Error(
      "Usage: pnpm room create NAME [REVISION] | start NAME | stop NAME | status NAME | list",
    );

  const primary = await primaryRoot();

  if (command === "list") {
    const directory = await stateRoot(primary);

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const manifest = await json(join(directory, entry.name, "room.json"));

      if (manifest) await printStatus(manifest);
    }

    return;
  }

  validateName(name);

  if (command === "create") {
    const destination = join(primary, ".room", name);

    try {
      await lstat(destination);
      throw new Error(
        "Room destination already exists. Use start to prepare an existing room.",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    const commit = git(primary, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${revision || "HEAD"}^{commit}`,
    ]);
    const plan = await allocation(primary, name);
    git(primary, ["worktree", "add", "--detach", destination, commit]);
    await startRoom(plan);

    return;
  }

  // Read-only commands and stop never allocate or adopt an unknown room.
  const directory = await stateRoot(primary);
  const current = await json(join(directory, name, "room.json"));
  const plan =
    current || (command === "start" ? await allocation(primary, name) : null);

  if (!plan)
    throw new Error("Room has no runtime allocation; run start NAME first.");

  const expected = roomPlan(primary, name, plan.slot);

  if (JSON.stringify(expected) !== JSON.stringify(plan))
    throw new Error("Room allocation has unexpected ownership or paths.");

  await verifyWorktree(plan);

  if (command === "start") await startRoom(plan);
  else if (command === "stop") await stopRoom(plan);
  else await printStatus(plan);
}

if (process.argv[1] && resolve(process.argv[1]) === runner) {
  main().catch((error) => {
    console.error(`[room] ${error.message}`);
    process.exitCode = 1;
  });
}
