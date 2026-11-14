import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function listUsersData(
  db: Kysely<DB>,
  input: {
    search: string;
    position?: { name: string; id: string };
    limit: number;
  },
) {
  let query = db
    .selectFrom("users")
    .select(["id", "display_name", "email", "role", "created_at"])
    .select(sql<string>`coalesce(display_name, '')`.as("cursor_name"))
    .where("role", "=", "customer");
  if (input.search)
    query = query.where(
      sql<boolean>`strpos(lower(concat_ws(' ', display_name, email)), ${input.search}) > 0`,
    );
  if (input.position)
    query = query.where(
      sql<boolean>`(coalesce(display_name, ''), id) > (${input.position.name}, ${input.position.id}::uuid)`,
    );
  return query
    .orderBy(sql`coalesce(display_name, '')`, "asc")
    .orderBy("id", "asc")
    .limit(input.limit + 1)
    .execute();
}

export async function userDirectoryStats(db: Kysely<DB>) {
  const row = await db
    .selectFrom("users")
    .select([
      sql<number>`count(*) filter (where role = 'customer')::int`.as(
        "customer_total",
      ),
      sql<number>`count(*) filter (where role = 'customer' and date_trunc('month', created_at at time zone 'Asia/Manila') = date_trunc('month', now() at time zone 'Asia/Manila'))::int`.as(
        "customer_joined",
      ),
    ])
    .executeTakeFirstOrThrow();
  return {
    customerTotal: row.customer_total,
    customerJoined: row.customer_joined,
  };
}
