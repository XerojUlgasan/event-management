import type { Insertable, Kysely, Transaction } from "kysely";
import type { AuditEvents, DB } from "../../db/types.js";

export function createAuditEventData(db: Kysely<DB> | Transaction<DB>, values: Insertable<AuditEvents>) {
  return db.insertInto("audit_events").values(values).execute();
}
