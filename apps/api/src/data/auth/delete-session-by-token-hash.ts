import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function deleteSessionByTokenHashData(db: Database, tokenHash: string) {
  return db.deleteFrom("sessions").where("token_hash", "=", tokenHash).execute();
}
