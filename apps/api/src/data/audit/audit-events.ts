import type { Insertable, Kysely, Transaction } from "kysely";
import type { AuditEvents, DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export function createAuditEventData(
  db: Database,
  values: Insertable<AuditEvents>,
) {
  return db.insertInto("audit_events").values(values).execute();
}
