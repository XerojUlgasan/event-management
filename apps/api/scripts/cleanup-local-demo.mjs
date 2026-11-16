// One-time, local-only cleanup. Requires --execute and a new private backup path.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { env } from "../src/utils/env.ts";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
if (
  process.argv.length !== 4 ||
  process.argv[2] !== "--execute" ||
  !process.argv[3].startsWith("/")
)
  throw new Error(
    "Usage: node apps/api/scripts/cleanup-local-demo.mjs --execute /absolute/new-private-backup.json",
  );
let databaseConfig;
try {
  databaseConfig = {
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  };
} catch {
  throw new Error("DB_NAME, DB_USER, and DB_PASSWORD are required");
}
if (!["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST))
  throw new Error("Only local PostgreSQL is allowed");
const services = [
  "03b6b27f-4364-5741-ac96-0285a868c6f2",
  "2d27fee0-e7da-5a3e-b37b-614aa3c85885",
  "3c75df30-d2a9-5dcc-af18-f27a4b555e2b",
  "fee148d6-a117-5522-a9fb-0406c86ba779",
];
const packages = [
  "4075f271-2d9a-5bca-814d-b47632047e81",
  "9bcad418-188e-5121-93a6-6f186a548ff9",
  "d125d446-41df-5a8f-93c3-a63d00b37ebe",
];
const serviceVersions = [
  "575ade3f-44c3-5b59-bbc5-40e7dc36a140",
  "8c2f3db3-4c8e-4566-ad3f-7bdc3e724f9d",
  "9aa2938d-c970-5e9c-9fc7-7c3c61d28c83",
  "b8241291-e81b-472b-990f-7a2403605797",
  "eadc1d84-bec8-5ad2-8365-1e6c16e74e3b",
  "ffbb2322-2054-53ae-84b4-97d1eb15f8d1",
];
const packageVersions = [
  "2ca9e405-2358-5eaf-bffd-100a1f04fe29",
  "34b9c787-f6b4-5ef8-b900-53eb5fd3256f",
  "8a740963-cd08-5a14-a640-c2ec3038e210",
];
const requests = [
  "e94209da-c3b1-4f5c-b014-bbd376366844",
  "dbf51ba9-dfc5-48d3-9296-75cb4a7bd7c1",
  "371601fd-38f5-4b41-b9a1-ef9309a1a35d",
  "4065437c-b9b3-5342-9ef2-16636eb742cd",
  "90e58686-38a7-510f-a390-c5db60f59549",
  "bc79921a-1cb2-5776-b8f7-f6c209997b7b",
  "acda8abe-e32f-5464-9dcc-ee2e4f43be90",
  "3a759d98-1f6e-5916-8ca2-2345184b5cff",
  "4403c41e-3970-5f65-8888-4c63fbff4b36",
  "a51629af-6f52-53c6-96a3-ecd0001f6093",
  "e308a6e7-90ce-50a0-ae3f-6b19bc5782f1",
  "4ad99bcf-6455-511e-a035-64e7eca78e68",
  "34f9de04-277c-56b2-9264-bfff070461f3",
];
const conversations = [
  "82d210b0-880d-43a8-b2d5-c7ade5ef7048",
  "aaeb190c-3699-443b-8ca2-fe03ecd7b5c7",
];
const pool = new pg.Pool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  ...databaseConfig,
});
const client = await pool.connect();
const sameIds = (rows, expected, label) => {
  if (
    JSON.stringify(rows.map((r) => r.id).sort()) !==
    JSON.stringify([...expected].sort())
  )
    throw new Error(`${label} changed; aborting`);
};
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query(
    "LOCK TABLE services, service_versions, packages, package_versions, package_services, booking_requests, booking_request_status_history, conversations, messages IN SHARE ROW EXCLUSIVE MODE",
  );
  const backup = {};
  const get = async (key, sql, values) => {
    const result = await client.query(sql, values);
    backup[key] = result.rows;
    return result.rows;
  };
  sameIds(
    await get("services", "SELECT * FROM services WHERE id = ANY($1::uuid[])", [
      services,
    ]),
    services,
    "Services",
  );
  sameIds(
    await get(
      "service_versions",
      "SELECT * FROM service_versions WHERE service_id = ANY($1::uuid[])",
      [services],
    ),
    serviceVersions,
    "Service versions",
  );
  sameIds(
    await get("packages", "SELECT * FROM packages WHERE id = ANY($1::uuid[])", [
      packages,
    ]),
    packages,
    "Packages",
  );
  sameIds(
    await get(
      "package_versions",
      "SELECT * FROM package_versions WHERE package_id = ANY($1::uuid[])",
      [packages],
    ),
    packageVersions,
    "Package versions",
  );
  const assignments = await get(
    "package_services",
    "SELECT * FROM package_services WHERE package_version_id = ANY($1::uuid[]) OR service_version_id = ANY($2::uuid[])",
    [packageVersions, serviceVersions],
  );
  if (
    assignments.length !== 12 ||
    assignments.some(
      (r) =>
        !packageVersions.includes(r.package_version_id) ||
        !serviceVersions.includes(r.service_version_id),
    )
  )
    throw new Error("Assignments changed; aborting");
  sameIds(
    await get(
      "booking_requests",
      "SELECT * FROM booking_requests WHERE package_id = ANY($1::uuid[]) OR package_version_id = ANY($2::uuid[])",
      [packages, packageVersions],
    ),
    requests,
    "Inquiries",
  );
  const history = await get(
    "booking_request_status_history",
    "SELECT * FROM booking_request_status_history WHERE booking_request_id = ANY($1::uuid[])",
    [requests],
  );
  if (history.length !== 19)
    throw new Error("Inquiry history changed; aborting");
  sameIds(
    await get(
      "conversations",
      "SELECT * FROM conversations WHERE booking_request_id = ANY($1::uuid[])",
      [requests],
    ),
    conversations,
    "Linked conversations",
  );
  if (
    (
      await client.query(
        "SELECT 1 FROM messages WHERE conversation_id = ANY($1::uuid[]) LIMIT 1",
        [conversations],
      )
    ).rowCount
  )
    throw new Error("Linked conversation has messages; aborting");
  const file = resolve(process.argv[3]);
  await writeFile(file, JSON.stringify(backup, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  for (const [table, ids] of [
    ["conversations", conversations],
    ["booking_requests", requests],
    ["packages", packages],
    ["services", services],
  ]) {
    const deleted = await client.query(
      `DELETE FROM ${table} WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    if (deleted.rowCount !== ids.length)
      throw new Error(`${table} delete count changed; aborting`);
  }
  await client.query("COMMIT");
  console.log("Cleanup committed; private backup written to", file);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
