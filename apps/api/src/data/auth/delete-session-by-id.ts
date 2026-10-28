import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function deleteSessionByIdData(db: Database, id: string) {
  return db.deleteFrom("sessions").where("id", "=", id).execute();
}
