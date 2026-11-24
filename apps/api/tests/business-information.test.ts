import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import {
  businessInformationResponseSchema,
  emptyBusinessInformation,
  MAX_BUSINESS_FAQS,
  MAX_BUSINESS_LINKS,
  MAX_BUSINESS_SHORT_TEXT,
  MAX_BUSINESS_TEXT,
  MAX_BUSINESS_URL,
  type BusinessInformation,
  type BusinessInformationResponse,
} from "@event-management/contracts/business-information";
import { Pool } from "pg";
import { matchRouteFamily } from "../src/edge/match-route.js";
import {
  buildMaximalValidBusinessInformationSaveBody,
  WORST_CASE_VALID_BUSINESS_INFORMATION_SAVE_BYTES,
} from "./fixtures/business-information.js";
import { BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES } from "../src/constants/http.js";
import { hashSessionToken } from "../src/utils/session.js";
import { setTestConfig } from "./helpers/set-test-config.js";

const database = `em_business_info_test_${randomUUID().replaceAll("-", "")}`;

const publicPath = "/business-information";
const adminPath = "/admin/business-information";

let adminPool: Pool;
let pool: Pool;
let db: typeof import("../src/db/client.js").db;
let app!: typeof import("../src/app.js").app;
let edge!: typeof import("../src/edge/server.js").app;
let adminCookie: string;
let customerCookie: string;

before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  adminPool = new Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });

  const migrations = new URL("../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(
        new URL(`${entry.name}/migration.sql`, migrations),
        "utf8",
      ),
    );

  setTestConfig({ DB_NAME: database });
  ({ app } = await import("../src/app.js"));
  ({ app: edge } = await import("../src/edge/server.js"));
  ({ db } = await import("../src/db/client.js"));

  async function session(role: "admin" | "customer") {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        role,
        password_hash: "unused",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3_600_000),
      })
      .execute();

    return `em_session=${token}`;
  }

  adminCookie = await session("admin");
  customerCookie = await session("customer");
});

after(async () => {
  await db?.destroy();
  await pool?.end();

  if (adminPool) {
    try {
      await adminPool.query(
        `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
      );
    } finally {
      await adminPool.end();
    }
  }
});

function request(
  runtime: typeof app,
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
) {
  return runtime.request(`/v1${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : {
          body: typeof body === "string" ? body : JSON.stringify(body),
        }),
  });
}

async function read(
  response: Response,
  status = 200,
): Promise<BusinessInformationResponse> {
  assert.equal(response.status, status, await response.clone().text());
  const payload = businessInformationResponseSchema.parse(
    await response.json(),
  );

  return payload;
}

function sampleInformation(): BusinessInformation {
  return {
    ...emptyBusinessInformation(),
    about: {
      ...emptyBusinessInformation().about,
      name: "Clemora Events",
      tagline: "Celebrations planned with care",
      introduction: "We plan weddings and corporate events.",
    },
    contact: {
      ...emptyBusinessInformation().contact,
      email: "hello@example.test",
      phone: "09171234567",
      website: "https://example.test",
    },
    location: {
      ...emptyBusinessInformation().location,
      city: "Manila",
    },
    hours: {
      ...emptyBusinessInformation().hours,
      timeZone: "Asia/Manila",
      monday: "9:00 AM – 6:00 PM",
    },
    otherLinks: [{ label: "Portfolio", url: "https://example.test/portfolio" }],
    faqs: [
      {
        question: "Do you travel?",
        answer: "Yes, within Metro Manila and nearby provinces.",
      },
    ],
  };
}

for (const [label, runtime] of [
  ["Node", () => app] as const,
  ["Edge", () => edge] as const,
]) {
  test(`${label} public read returns blank defaults`, async () => {
    const payload = await read(await request(runtime(), publicPath));
    assert.deepEqual(payload.information, emptyBusinessInformation());
    assert.ok(payload.updatedAt);
  });
}

test("missing singleton reads as empty and first save creates a reloadable row", async () => {
  await pool.query("DELETE FROM business_information WHERE id = 1");

  for (const runtime of [app, edge]) {
    const absent = await read(await request(runtime, publicPath));
    assert.deepEqual(absent.information, emptyBusinessInformation());
    assert.equal(absent.updatedAt, null);
  }

  const editor = await read(
    await request(app, adminPath, "GET", undefined, adminCookie),
  );
  assert.deepEqual(editor.information, emptyBusinessInformation());
  assert.equal(editor.updatedAt, null);

  const information = sampleInformation();
  const saved = await read(
    await request(
      app,
      adminPath,
      "PUT",
      { information, expectedUpdatedAt: editor.updatedAt },
      adminCookie,
    ),
  );
  assert.deepEqual(saved.information, information);
  assert.ok(saved.updatedAt);

  const persisted = await pool.query<{ information: BusinessInformation }>(
    "SELECT information FROM business_information WHERE id = 1",
  );
  assert.equal(persisted.rowCount, 1);
  assert.deepEqual(persisted.rows[0]?.information, information);

  assert.deepEqual(
    await read(await request(edge, adminPath, "GET", undefined, adminCookie)),
    saved,
  );

  for (const runtime of [app, edge]) {
    const reloaded = await read(await request(runtime, publicPath));
    assert.deepEqual(reloaded, saved);
  }
});

test("concurrent first saves with no singleton allow one winner", async () => {
  await pool.query("DELETE FROM business_information WHERE id = 1");

  const candidates = ["First writer A", "First writer B"].map((name) => ({
    ...sampleInformation(),
    about: { ...sampleInformation().about, name },
  }));

  const responses = await Promise.all(
    [app, edge].map((runtime, index) =>
      request(
        runtime,
        adminPath,
        "PUT",
        { information: candidates[index], expectedUpdatedAt: null },
        adminCookie,
      ),
    ),
  );

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );

  const winnerIndex = responses.findIndex(
    (response) => response.status === 200,
  );

  const saved = await read(responses[winnerIndex]);
  assert.deepEqual(saved.information, candidates[winnerIndex]);

  const persisted = await pool.query<{ information: BusinessInformation }>(
    "SELECT information FROM business_information WHERE id = 1",
  );
  assert.equal(persisted.rowCount, 1);
  assert.deepEqual(persisted.rows[0]?.information, saved.information);
  assert.deepEqual(await read(await request(app, publicPath)), saved);
  assert.deepEqual(await read(await request(edge, publicPath)), saved);
});

test("permissions guard admin routes", async () => {
  assert.equal((await request(app, adminPath)).status, 401);
  assert.equal(
    (
      await request(app, adminPath, "PUT", {
        information: emptyBusinessInformation(),
        expectedUpdatedAt: new Date().toISOString(),
      })
    ).status,
    401,
  );
  assert.equal(
    (await request(app, adminPath, "GET", undefined, customerCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        app,
        adminPath,
        "PUT",
        {
          information: emptyBusinessInformation(),
          expectedUpdatedAt: new Date().toISOString(),
        },
        customerCookie,
      )
    ).status,
    403,
  );
});

test("admin save persists and public read reflects content", async () => {
  const current = await read(
    await request(app, adminPath, "GET", undefined, adminCookie),
  );
  const information = sampleInformation();
  const saved = await read(
    await request(
      app,
      adminPath,
      "PUT",
      { information, expectedUpdatedAt: current.updatedAt },
      adminCookie,
    ),
  );
  assert.equal(saved.information.about.name, "Clemora Events");
  assert.equal(saved.information.contact.email, "hello@example.test");
  assert.notEqual(saved.updatedAt, current.updatedAt);

  const published = await read(await request(app, publicPath));
  assert.deepEqual(published.information, saved.information);
  assert.equal(published.updatedAt, saved.updatedAt);
});

test("rejects stale and subsequent writes using an old timestamp", async () => {
  const current = await read(
    await request(app, adminPath, "GET", undefined, adminCookie),
  );
  const stale = await request(
    app,
    adminPath,
    "PUT",
    {
      information: {
        ...sampleInformation(),
        about: { ...sampleInformation().about, name: "Stale" },
      },
      expectedUpdatedAt: new Date(Date.now() - 60_000).toISOString(),
    },
    adminCookie,
  );
  assert.equal(stale.status, 409);

  const first = await read(
    await request(
      app,
      adminPath,
      "PUT",
      {
        information: {
          ...sampleInformation(),
          about: { ...sampleInformation().about, name: "First" },
        },
        expectedUpdatedAt: current.updatedAt,
      },
      adminCookie,
    ),
  );
  const second = await request(
    app,
    adminPath,
    "PUT",
    {
      information: {
        ...sampleInformation(),
        about: { ...sampleInformation().about, name: "Second" },
      },
      expectedUpdatedAt: current.updatedAt,
    },
    adminCookie,
  );
  assert.equal(second.status, 409);

  const latest = await read(
    await request(app, adminPath, "GET", undefined, adminCookie),
  );
  assert.equal(latest.information.about.name, "First");
  assert.equal(latest.updatedAt, first.updatedAt);
});

test("concurrent Node and Edge saves allow one winner and preserve its full document", async () => {
  const current = await read(
    await request(app, adminPath, "GET", undefined, adminCookie),
  );

  const candidates = ["Concurrent A", "Concurrent B"].map((name) => ({
    ...sampleInformation(),
    about: { ...sampleInformation().about, name },
    policies: { ...emptyBusinessInformation().policies, cancellation: name },
  }));

  const responses = await Promise.all(
    [app, edge].map((runtime, index) =>
      request(
        runtime,
        adminPath,
        "PUT",
        {
          information: candidates[index],
          expectedUpdatedAt: current.updatedAt,
        },
        adminCookie,
      ),
    ),
  );

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );

  const winnerIndex = responses.findIndex(
    (response) => response.status === 200,
  );

  const saved = await read(responses[winnerIndex]);
  assert.deepEqual(saved.information, candidates[winnerIndex]);
  assert.deepEqual(await read(await request(app, publicPath)), saved);
  assert.deepEqual(await read(await request(edge, publicPath)), saved);
  const persisted = await pool.query(
    "SELECT information FROM business_information WHERE id=1",
  );
  assert.deepEqual(persisted.rows[0].information, saved.information);
});

test("validation rejects invalid URLs, emails, timezone, limits, whitespace, and unknown keys", async () => {
  const current = await read(
    await request(app, adminPath, "GET", undefined, adminCookie),
  );
  const base = {
    expectedUpdatedAt: current.updatedAt,
    information: sampleInformation(),
  };

  const cases: Array<{ patch: unknown; path?: string }> = [
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          contact: { ...base.information.contact, email: "not-an-email" },
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          contact: {
            ...base.information.contact,
            website: "ftp://example.test",
          },
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          hours: { ...base.information.hours, timeZone: "Not/AZone" },
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          about: {
            ...base.information.about,
            name: "x".repeat(MAX_BUSINESS_SHORT_TEXT + 1),
          },
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          about: {
            ...base.information.about,
            introduction: "x".repeat(MAX_BUSINESS_TEXT + 1),
          },
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          otherLinks: Array.from(
            { length: MAX_BUSINESS_LINKS + 1 },
            (_, index) => ({
              label: `Link ${index}`,
              url: `https://example.test/${index}`,
            }),
          ),
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          faqs: Array.from({ length: MAX_BUSINESS_FAQS + 1 }, (_, index) => ({
            question: `Question ${index}`,
            answer: "Answer",
          })),
        },
      },
    },
    {
      patch: {
        ...base,
        information: {
          ...base.information,
          otherLinks: [
            {
              label: "Portfolio",
              url: `https://example.test/${"a".repeat(MAX_BUSINESS_URL)}`,
            },
          ],
        },
      },
    },
    {
      patch: {
        ...base,
        rogueField: "nope",
      },
    },
  ];

  for (const { patch } of cases) {
    const response = await request(app, adminPath, "PUT", patch, adminCookie);
    assert.equal(response.status, 400, await response.clone().text());
  }

  const whitespaceSave = await read(
    await request(
      app,
      adminPath,
      "PUT",
      {
        expectedUpdatedAt: current.updatedAt,
        information: {
          ...sampleInformation(),
          about: { ...sampleInformation().about, name: "  Leading spaces  " },
        },
      },
      adminCookie,
    ),
  );
  assert.equal(whitespaceSave.information.about.name, "Leading spaces");
});

test("measured maximal valid save body stays below the configured byte cap", () => {
  assert.ok(
    WORST_CASE_VALID_BUSINESS_INFORMATION_SAVE_BYTES <
      BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES,
  );
  assert.equal(BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES, 2 * 1024 * 1024);
});

for (const [label, runtime] of [
  ["Node", () => app] as const,
  ["Edge", () => edge] as const,
]) {
  test(`${label} accepts maximal valid save and rejects one byte over the cap`, async () => {
    const current = await read(
      await request(runtime(), adminPath, "GET", undefined, adminCookie),
    );
    assert.ok(current.updatedAt);
    const maximal = JSON.stringify(
      buildMaximalValidBusinessInformationSaveBody(current.updatedAt),
    );
    assert.equal(
      Buffer.byteLength(maximal, "utf8"),
      WORST_CASE_VALID_BUSINESS_INFORMATION_SAVE_BYTES,
    );

    await read(
      await request(runtime(), adminPath, "PUT", maximal, adminCookie),
      200,
    );

    const overLimit =
      maximal +
      "x".repeat(
        BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES -
          WORST_CASE_VALID_BUSINESS_INFORMATION_SAVE_BYTES +
          1,
      );
    assert.equal(
      Buffer.byteLength(overLimit, "utf8"),
      BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES + 1,
    );
    assert.equal(
      (await request(runtime(), adminPath, "PUT", overLimit, adminCookie))
        .status,
      413,
    );
  });
}

test("OpenAPI and Edge route registration expose business information routes", async () => {
  assert.equal(
    matchRouteFamily("/v1/business-information"),
    "business-information",
  );
  assert.equal(
    matchRouteFamily("/v1/admin/business-information"),
    "business-information",
  );
  assert.equal(matchRouteFamily("/v1/business-information-secret"), null);

  for (const runtime of [app, edge]) {
    const document = (await (
      await runtime.request("/openapi.json")
    ).json()) as { paths: Record<string, unknown> };
    assert.ok(document.paths["/v1/business-information"]);
    assert.ok(document.paths["/v1/admin/business-information"]);
  }
});

test("migration keeps singleton row, RLS, and direct client grants closed", async () => {
  const singleton = await pool.query<{ id: number }>(
    "SELECT id FROM business_information",
  );
  assert.equal(singleton.rowCount, 1);
  assert.equal(singleton.rows[0]?.id, 1);

  await assert.rejects(
    () => pool.query("INSERT INTO business_information (id) VALUES (2)"),
    /business_information_singleton_check/,
  );

  const rls = await pool.query<{
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'business_information'",
  );
  assert.equal(rls.rows[0]?.relrowsecurity, true);
  assert.equal(rls.rows[0]?.relforcerowsecurity, false);

  const clientRoles = await pool.query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname",
  );

  for (const { rolname } of clientRoles.rows) {
    const privileges = await pool.query<{ has_table_privilege: boolean }>(
      "SELECT has_table_privilege($1, 'public.business_information', 'SELECT')",
      [rolname],
    );
    assert.equal(privileges.rows[0]?.has_table_privilege, false, rolname);
  }
});
