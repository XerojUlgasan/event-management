import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

/** Lock in ID order across saves, deletes, and shared media cleanup. */
export const lockShowcaseMediaData = (
  db: Transaction<DB>,
  ids: string[],
  recordId?: string,
) =>
  db
    .selectFrom("media_assets")
    .select(["id", "kind", "showcase_record_id"])
    .where((eb) =>
      eb.or([
        ...(ids.length ? [eb("id", "in", ids)] : []),
        ...(recordId ? [eb("showcase_record_id", "=", recordId)] : []),
      ]),
    )
    .orderBy("id")
    .forUpdate()
    .execute();
