import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { databaseUrl } from "./config.js";
import type { DB } from "./types.js";

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: databaseUrl }),
  }),
});
