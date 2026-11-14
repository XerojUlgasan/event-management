import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function findSessionByTokenHashData(db: Database, tokenHash: string) {
  return db
    .selectFrom("sessions")
    .selectAll()
    .where("token_hash", "=", tokenHash)
    .executeTakeFirst();
}
