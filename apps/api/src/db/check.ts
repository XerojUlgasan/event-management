import { sql } from "kysely";
import { db } from "./client.js";

try {
  await sql`select 1`.execute(db);
  console.log("Database connection OK");
} finally {
  await db.destroy();
}
