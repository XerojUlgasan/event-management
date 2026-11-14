import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function listUsersData(
  db: Kysely<DB>,
  input: {
    group: "staff" | "customers";
    search: string;
    position?: { name: string; id: string };
    limit: number;
  },
) {
  let query = db
    .selectFrom("users")
    .select(["id", "display_name", "email", "role", "staff_role", "created_at"])
    .select(sql<string>`coalesce(display_name, '')`.as("cursor_name"))
    .where(
      "role",
      "in",
      input.group === "staff" ? ["admin", "staff"] : ["customer"],
    );
  if (input.search)
    query = query.where(
      sql<boolean>`strpos(lower(concat_ws(' ', display_name, ${input.group === "staff" ? sql`staff_role` : sql`NULL`}, email)), ${input.search}) > 0`,
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
      sql<number>`count(*) filter (where role in ('admin', 'staff'))::int`.as(
        "staff_total",
      ),
      sql<number>`count(*) filter (where role = 'customer')::int`.as(
        "customer_total",
      ),
      sql<number>`count(distinct staff_role) filter (where role in ('admin', 'staff') and staff_role <> '')::int`.as(
        "staff_roles",
      ),
      sql<number>`count(*) filter (where role in ('admin', 'staff') and date_trunc('month', created_at at time zone 'Asia/Manila') = date_trunc('month', now() at time zone 'Asia/Manila'))::int`.as(
        "staff_joined",
      ),
      sql<number>`count(*) filter (where role = 'customer' and date_trunc('month', created_at at time zone 'Asia/Manila') = date_trunc('month', now() at time zone 'Asia/Manila'))::int`.as(
        "customer_joined",
      ),
    ])
    .executeTakeFirstOrThrow();
  return {
    staffTotal: row.staff_total,
    customerTotal: row.customer_total,
    staffRoles: row.staff_roles,
    staffJoined: row.staff_joined,
    customerJoined: row.customer_joined,
  };
}
