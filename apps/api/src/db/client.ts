import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { databaseUrl } from "./config.js";
import type { DB } from "./types.js";

const pool = new Pool({ connectionString: databaseUrl });

// pg evicts disconnected idle clients before emitting this event.
pool.on("error", () => {
  console.error("An idle database connection was lost.");
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});
