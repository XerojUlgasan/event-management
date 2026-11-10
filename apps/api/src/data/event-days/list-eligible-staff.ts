import { sql } from "kysely";
import type { Database } from "./types.js";

export async function listEligibleStaffData(db: Database) {
  return (
    await sql<{
      id: string;
      display_name: string;
    }>`select id,coalesce(display_name,'Staff') as display_name from users where role='staff' order by display_name,id`.execute(
      db,
    )
  ).rows;
}
