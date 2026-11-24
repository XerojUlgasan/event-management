import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { Profile } from "../src/controllers/auth/profile.js";
import { setTestConfig } from "./helpers/set-test-config.js";

const projectId = "demo-event-management";

const database = `em_auth_test_${randomUUID().replaceAll("-", "")}`;

const password = "testpass";
const firebasePassword = "firebase-test-password";
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;

let firebase: Awaited<
  ReturnType<typeof import("../src/utils/firebase-admin.js").getFirebaseAuth>
>;

let admin: Pool;
let pool: Pool;

before(async () => {
  assert.match(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "",
    /^127\.0\.0\.1:\d+$/,
    "Run with the local Firebase Auth emulator; never use a live Firebase project for these tests.",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
    "Tests require local PostgreSQL.",
  );
  setTestConfig({ FIREBASE_PROJECT_ID: projectId });
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }

  // Import configuration only after selecting the disposable database.
  setTestConfig({ DB_NAME: database });
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  firebase = await (
    await import("../src/utils/firebase-admin.js")
  ).getFirebaseAuth();
});

after(async () => {
  await db?.destroy();
  await pool?.end();

  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(
  path: string,
  body?: unknown,
  cookie?: string,
  token?: string,
  headers: Record<string, string> = {},
) {
  return app.request(`/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function cookieOf(response: Response) {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.ok(cookie.startsWith("em_session="));

  return cookie;
}

async function profileOf(response: Response, expected = 200) {
  assert.equal(response.status, expected, await response.clone().text());
  const profile = (await response.json()) as Profile;
  assert.equal("password_hash" in profile, false);
  assert.equal("passwordHash" in profile, false);

  return profile;
}

async function register(email: string) {
  const response = await call("/auth/register", {
    email,
    password,
    displayName: "Test Customer",
    role: "admin",
  });

  return {
    cookie: cookieOf(response),
    profile: await profileOf(response, 201),
  };
}

async function emulatorRequest(operation: string, body: unknown) {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  assert.equal(response.status, 200, await response.clone().text());

  return (await response.json()) as { idToken: string; localId: string };
}

async function google(email: string) {
  return emulatorRequest("signInWithIdp", {
    requestUri: "http://localhost",
    returnSecureToken: true,
    postBody: new URLSearchParams({
      providerId: "google.com",
      id_token: JSON.stringify({
        sub: email,
        email,
        email_verified: true,
        name: "Google Test User",
      }),
    }).toString(),
  });
}

async function firebaseEmail(email: string, verified = false) {
  const user = await firebase.createUser({
    email,
    password: firebasePassword,
    emailVerified: verified,
  });
  const result = await emulatorRequest("signInWithPassword", {
    email,
    password: firebasePassword,
    returnSecureToken: true,
  });

  return { ...result, uid: user.uid };
}

// Only the emulator accepts unsigned tokens, allowing old/malformed auth-time tests.
function changeClaims(token: string, changes: Record<string, unknown>) {
  const [header, encoded] = token.split(".");

  return `${header}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(encoded, "base64url").toString()), ...changes })).toString("base64url")}.`;
}

async function assertGuestClaimAfterAuthentication(
  authenticate: (guestCookie: string) => Response | Promise<Response>,
  expectedAuthStatus: number,
) {
  const bootstrap = await call("/guest/conversation", {});
  assert.equal(bootstrap.status, 200, await bootstrap.clone().text());
  const guestCookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  assert.ok(guestCookie);
  assert.ok(guestCookie.startsWith("em_guest="));
  const guest = (await bootstrap.json()) as { conversation: { id: string } };

  const authentication = await authenticate(guestCookie);
  const sessionCookie = cookieOf(authentication);
  const profile = await profileOf(authentication, expectedAuthStatus);
  const claim = await call(
    `/guest/conversations/${guest.conversation.id}/claim`,
    {},
    `${guestCookie}; ${sessionCookie}`,
  );
  assert.equal(claim.status, 200, await claim.clone().text());
  assert.deepEqual(await claim.json(), {
    conversationId: guest.conversation.id,
  });
  assert.equal(
    (
      await call(
        `/guest/conversations/${guest.conversation.id}`,
        undefined,
        guestCookie,
      )
    ).status,
    404,
  );
  const owned = await call(
    `/messages/conversations/${guest.conversation.id}`,
    undefined,
    sessionCookie,
  );
  assert.equal(owned.status, 200, await owned.clone().text());
  const thread = (await owned.json()) as {
    conversation: { id: string; customerId: string };
  };
  assert.equal(thread.conversation.id, guest.conversation.id);
  assert.equal(thread.conversation.customerId, profile.id);
}

test("eight-character passwords register, hash securely and restore the customer session", async () => {
  const response = await call("/auth/register", {
    email: "  LOCAL@example.com  ",
    password,
    displayName: "Local User",
    role: "admin",
  });
  const profile = await profileOf(response, 201);
  assert.equal(profile.email, "local@example.com");
  assert.equal(profile.firebaseUid, null);
  assert.equal(profile.hasPassword, true);
  assert.equal(profile.role, "customer");
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=Lax/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const stored = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", profile.id)
    .executeTakeFirstOrThrow();
  assert.match(stored.password_hash!, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(stored.password_hash, password);
  const cookie = cookieOf(response);
  const session = await db
    .selectFrom("sessions")
    .selectAll()
    .where("user_id", "=", profile.id)
    .executeTakeFirstOrThrow();
  assert.notEqual(session.token_hash, cookie.split("=")[1]);
  assert.equal(session.token_hash.length, 64);
  assert.equal(
    (await profileOf(await call("/me", undefined, cookie))).id,
    profile.id,
  );
  const other = await register("salt@example.com");
  const otherHash = await db
    .selectFrom("users")
    .select("password_hash")
    .where("id", "=", other.profile.id)
    .executeTakeFirstOrThrow();
  assert.notEqual(stored.password_hash, otherHash.password_hash);
});

test("duplicate emails, including case variants, never merge users", async () => {
  assert.equal(
    (
      await call("/auth/register", {
        email: "LOCAL@EXAMPLE.COM",
        password,
        displayName: "Imposter",
      })
    ).status,
    409,
  );
  const identity = await google("local@example.com");
  const response = await call("/auth/sync", {}, undefined, identity.idToken);
  assert.equal(response.status, 409);
  assert.equal(response.headers.has("set-cookie"), false);
  const row = await db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", "local@example.com")
    .executeTakeFirstOrThrow();
  assert.equal(row.firebase_uid, null);
  assert.equal(row.display_name, "Local User");
});

test("accounts with existing native Argon2id hashes can still log in", async () => {
  const account = await register("legacy-argon2@example.com");
  // Synthetic fixture generated by @node-rs/argon2 2.2.2, not an account hash.
  await db
    .updateTable("users")
    .set({
      password_hash:
        "$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1zYWx0LTE2Ynl0ZXM$M9ndicefOdcqlQ/tE6sBJdyfrVZkMTb9hJdqBmCguoY",
    })
    .where("id", "=", account.profile.id)
    .execute();
  const response = await call("/auth/login", {
    email: account.profile.email,
    password: "legacy-password",
  });
  assert.equal((await profileOf(response)).id, account.profile.id);
  assert.equal(
    (await profileOf(await call("/me", undefined, cookieOf(response)))).id,
    account.profile.id,
  );
});

test("wrong and unknown passwords have the same response; local login rotates sessions and preserves roles", async () => {
  const account = await register("login@example.com");
  const wrong = await call("/auth/login", {
    email: account.profile.email,
    password: "wrong",
  });
  const unknown = await call("/auth/login", {
    email: "missing@example.com",
    password: "wrong",
  });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
  await db
    .updateTable("users")
    .set({ role: "admin" })
    .where("id", "=", account.profile.id)
    .execute();
  const response = await call(
    "/auth/login",
    { email: " LOGIN@example.com ", password },
    account.cookie,
  );
  const profile = await profileOf(response);
  assert.equal(profile.id, account.profile.id);
  assert.equal(profile.role, "admin");
  assert.notEqual(cookieOf(response), account.cookie);
  assert.equal((await call("/me", undefined, account.cookie)).status, 401);
});

test("logout and expiry invalidate server sessions", async () => {
  const account = await register("logout@example.com");
  assert.equal((await call("/auth/logout", {}, account.cookie)).status, 204);
  assert.equal((await call("/me", undefined, account.cookie)).status, 401);
  const loginResponse = await call("/auth/login", {
    email: account.profile.email,
    password,
  });
  const cookie = cookieOf(loginResponse);
  await db
    .updateTable("sessions")
    .set({ expires_at: new Date(0) })
    .where("user_id", "=", account.profile.id)
    .execute();
  assert.equal((await call("/me", undefined, cookie)).status, 401);
  assert.equal(
    (
      await db
        .selectFrom("sessions")
        .selectAll()
        .where("user_id", "=", account.profile.id)
        .execute()
    ).length,
    0,
  );
});

test("new Google identities and existing Firebase email/password identities use the same profile API", async () => {
  const identity = await google("google@example.com");
  const response = await call("/auth/sync", {}, undefined, identity.idToken);
  const profile = await profileOf(response);
  assert.equal(profile.firebaseUid, identity.localId);
  assert.equal(profile.hasPassword, false);
  assert.equal(
    (await profileOf(await call("/me", undefined, cookieOf(response)))).id,
    profile.id,
  );
  const localLogin = await call("/auth/login", {
    email: profile.email,
    password: firebasePassword,
  });
  assert.equal(localLogin.status, 401);
  assert.equal(
    (
      await call("/auth/register", {
        email: profile.email,
        password,
        displayName: "Duplicate",
      })
    ).status,
    409,
  );
  const legacy = await firebaseEmail("legacy@example.com");
  // A pre-migration Firebase profile remains reachable even with mixed-case email.
  const existing = await db
    .insertInto("users")
    .values({
      firebase_uid: legacy.uid,
      email: "LEGACY@example.com",
      display_name: "Existing Admin",
      role: "admin",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const legacyProfile = await profileOf(
    await call("/auth/sync", {}, undefined, legacy.idToken),
  );
  assert.equal(legacyProfile.id, existing.id);
  assert.equal(legacyProfile.role, "admin");
  assert.equal(legacyProfile.displayName, "Existing Admin");
});

test("linking requires the session, correct local password and a recent verified Firebase identity", async () => {
  const account = await register("link@example.com");
  const identity = await google(account.profile.email);
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: password },
        undefined,
        identity.idToken,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: password },
        account.cookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: "wrong" },
        account.cookie,
        identity.idToken,
      )
    ).status,
    401,
  );
  const old = changeClaims(identity.idToken, {
    auth_time: Math.floor(Date.now() / 1000) - 600,
  });
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: password },
        account.cookie,
        old,
      )
    ).status,
    401,
  );
  const unverified = await firebaseEmail("unverified-link@example.com");
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: password },
        account.cookie,
        unverified.idToken,
      )
    ).status,
    401,
  );
  const response = await call(
    "/auth/link/firebase",
    { currentPassword: password },
    account.cookie,
    identity.idToken,
  );
  const linked = await profileOf(response);
  assert.equal(linked.id, account.profile.id);
  assert.equal(linked.firebaseUid, identity.localId);
  assert.equal(linked.hasPassword, true);
  assert.equal((await call("/me", undefined, account.cookie)).status, 401);
  assert.equal(
    (await profileOf(await call("/auth/sync", {}, undefined, identity.idToken)))
      .id,
    linked.id,
  );
  assert.equal(
    (
      await profileOf(
        await call("/auth/login", { email: account.profile.email, password }),
      )
    ).id,
    linked.id,
  );
  const replacement = await google("replacement@example.com");
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: password },
        cookieOf(response),
        replacement.idToken,
      )
    ).status,
    409,
  );
});

test("an identity already owned by another database account cannot be linked or merged", async () => {
  const account = await register("other-owner@example.com");
  const identity = await google("already-owned@example.com");
  const owner = await profileOf(
    await call("/auth/sync", {}, undefined, identity.idToken),
  );
  assert.equal(
    (
      await call(
        "/auth/link/firebase",
        { currentPassword: password },
        account.cookie,
        identity.idToken,
      )
    ).status,
    409,
  );
  const row = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", account.profile.id)
    .executeTakeFirstOrThrow();
  assert.equal(row.firebase_uid, null);
  assert.equal(
    (await profileOf(await call("/auth/sync", {}, undefined, identity.idToken)))
      .id,
    owner.id,
  );
});

test("Firebase users add a local password only after proving the same verified identity", async () => {
  const identity = await google("add-password@example.com");
  const response = await call("/auth/sync", {}, undefined, identity.idToken);
  const account = await profileOf(response);
  const cookie = cookieOf(response);
  const other = await google("different-identity@example.com");
  assert.equal(
    (await call("/auth/password", { password }, cookie, other.idToken)).status,
    401,
  );
  assert.equal(
    (
      await call(
        "/auth/password",
        { password },
        cookie,
        changeClaims(identity.idToken, { auth_time: 1 }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        "/auth/password",
        { password },
        cookie,
        changeClaims(identity.idToken, { email_verified: false }),
      )
    ).status,
    401,
  );
  const added = await call(
    "/auth/password",
    { password },
    cookie,
    identity.idToken,
  );
  const profile = await profileOf(added);
  assert.equal(profile.id, account.id);
  assert.equal(profile.hasPassword, true);
  assert.equal((await call("/me", undefined, cookie)).status, 401);
  assert.equal(
    (
      await profileOf(
        await call("/auth/login", { email: account.email, password }),
      )
    ).id,
    account.id,
  );
  assert.equal(
    (
      await call(
        "/auth/password",
        { password: "a different long password" },
        cookieOf(added),
        identity.idToken,
      )
    ).status,
    409,
  );
});

test("simultaneous links cannot attach one Firebase identity to two local users", async () => {
  const first = await register("race-first@example.com");
  const second = await register("race-second@example.com");
  const identity = await google("race-identity@example.com");

  const responses = await Promise.all(
    [first, second].map((account) =>
      call(
        "/auth/link/firebase",
        { currentPassword: password },
        account.cookie,
        identity.idToken,
      ),
    ),
  );

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  const rows = await db
    .selectFrom("users")
    .selectAll()
    .where("firebase_uid", "=", identity.localId)
    .execute();
  assert.equal(rows.length, 1);
});

test("Firebase tokens for disabled users and malformed tokens are rejected", async () => {
  assert.equal(
    (await call("/auth/sync", {}, undefined, "invalid")).status,
    401,
  );
  const identity = await firebaseEmail("disabled@example.com", true);
  await firebase.updateUser(identity.uid, { disabled: true });
  assert.equal(
    (await call("/auth/sync", {}, undefined, identity.idToken)).status,
    401,
  );
});

test("a local registration session claims the existing anonymous conversation", async () => {
  await assertGuestClaimAfterAuthentication(
    (guestCookie) =>
      call(
        "/auth/register",
        {
          email: "guest-registration@example.com",
          password,
          displayName: "Guest Registration",
        },
        guestCookie,
      ),
    201,
  );
});

test("a local password login session claims the existing anonymous conversation", async () => {
  const account = await register("guest-login@example.com");
  await call("/auth/logout", {}, account.cookie);
  await assertGuestClaimAfterAuthentication(
    (guestCookie) =>
      call(
        "/auth/login",
        { email: account.profile.email, password },
        guestCookie,
      ),
    200,
  );
});

test("a Firebase emulator sign-in session claims the existing anonymous conversation", async () => {
  await assertGuestClaimAfterAuthentication(async (guestCookie) => {
    const identity = await google("guest-firebase@example.com");

    return call("/auth/sync", {}, guestCookie, identity.idToken);
  }, 200);
});

test("validation, origin checks, body size limits and throttling protect password endpoints", async () => {
  assert.equal(
    (
      await call("/auth/register", {
        email: "bad",
        password,
        displayName: "Test",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/auth/register", {
        email: "short@example.com",
        password: "seven77",
        displayName: "Test",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/auth/register", {
        email: "large@example.com",
        password: "x".repeat(129),
        displayName: "Test",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/auth/login",
        { email: "anything@example.com", password },
        undefined,
        undefined,
        { Origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/auth/login", {
        email: "anything@example.com",
        password: "x".repeat(17000),
      })
    ).status,
    413,
  );

  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal(
      (
        await call("/auth/login", {
          email: "throttled@example.com",
          password: "wrong",
        })
      ).status,
      401,
    );
  }

  assert.equal(
    (
      await call("/auth/login", {
        email: " THROTTLED@example.com ",
        password: "wrong",
      })
    ).status,
    429,
  );
});

test("OpenAPI describes both account methods and never exposes the password hash", async () => {
  const spec = (await (await app.request("/openapi.json")).json()) as {
    paths: Record<string, unknown>;
  };

  for (const path of [
    "/v1/auth/register",
    "/v1/auth/login",
    "/v1/auth/sync",
    "/v1/auth/link/firebase",
    "/v1/auth/password",
    "/v1/me",
    "/v1/auth/logout",
  ]) {
    assert.ok(spec.paths[path], path);
  }

  assert.equal(JSON.stringify(spec).includes("password_hash"), false);
});

test("db:seed inserts fixtures without changing existing accounts or sessions", async () => {
  const unrelated = await register("unrelated-seed@example.com");
  const collision = await db
    .insertInto("users")
    .values({
      email: "customer10@example.test",
      display_name: "Existing account",
      role: "customer",
      password_hash: "existing-hash",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const plausible = await db
    .insertInto("users")
    .values({
      email: "marcos.reyes@clemora.com",
      display_name: "Real person",
      role: "customer",
      password_hash: "other-hash",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const existingAdmin = await db
    .insertInto("users")
    .values({
      email: "ADMIN1@gmail.com",
      firebase_uid: "seed-existing-firebase",
      display_name: "Existing account",
      role: "customer",
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const runSeed = () =>
    promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "src/db/seed.ts"],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: {
          ...process.env,
          FIREBASE_PROJECT_ID: "",
          FIREBASE_CLIENT_EMAIL: "",
          FIREBASE_PRIVATE_KEY: "",
          GOOGLE_APPLICATION_CREDENTIALS: "",
          FIREBASE_AUTH_EMULATOR_HOST: "",
        },
      },
    );

  await runSeed();

  for (const original of [collision, plausible, existingAdmin])
    assert.deepEqual(
      await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", original.id)
        .executeTakeFirstOrThrow(),
      original,
    );

  for (const email of [
    "user1@gmail.com",
    "user2@gmail.com",
    "user3@gmail.com",
    "user4@gmail.com",
    "user5@gmail.com",
    "customer1@example.test",
  ]) {
    const response = await call("/auth/login", {
      email,
      password: "p@ssword01",
    });
    const profile = await profileOf(response);
    assert.equal(profile.role, "customer");
  }

  await runSeed();

  for (const original of [collision, plausible, existingAdmin])
    assert.deepEqual(
      await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", original.id)
        .executeTakeFirstOrThrow(),
      original,
    );

  assert.equal((await call("/me", undefined, unrelated.cookie)).status, 200);
});
