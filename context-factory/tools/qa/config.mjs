import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
const { config } = require("dotenv");
config({ path: fileURLToPath(new URL("../../../apps/api/.env", import.meta.url)), quiet: true });

export function createClient() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) throw new Error("SUPABASE_DB_URL is required in the API environment.");
  const { Client } = require("pg");
  return new Client({
    connectionString,
    application_name: "amac-qa",
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
}
