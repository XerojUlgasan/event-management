import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function lockStaffData(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("users")
    .select("role")
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
}
