import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function listUsersData(db: Kysely<DB>, role: "admin" | "customer") {
  return db
    .selectFrom("users")
    .select(["id", "display_name", "email", "role", "staff_role", "created_at"])
    .where("role", "=", role)
    .orderBy("display_name", "asc")
    .execute();
}
