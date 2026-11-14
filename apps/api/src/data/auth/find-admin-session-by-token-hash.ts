import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findAdminSessionByTokenHashData(
  db: Database,
  tokenHash: string,
) {
  return db
    .selectFrom("sessions as s")
    .innerJoin("users as u", "u.id", "s.user_id")
    .select("s.id")
    .where("s.token_hash", "=", tokenHash)
    .where("s.expires_at", ">", new Date())
    .where("u.role", "=", "admin")
    .where("u.staff_role", "=", "System Administrator")
    .executeTakeFirst();
}
