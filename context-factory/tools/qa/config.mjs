import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
const { config } = require("dotenv");
config({ path: fileURLToPath(new URL("../../../apps/api/.env", import.meta.url)), quiet: true });

export function createClient() {
  for (const name of ["DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    if (!process.env[name]) throw new Error(`${name} is required in the API environment.`);
  }
  const { Client } = require("pg");
  return new Client({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    application_name: "clemora-qa",
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
}
