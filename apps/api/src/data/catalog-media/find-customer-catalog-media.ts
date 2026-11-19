import { sql } from "kysely";
import { catalogOwnerContainsMedia } from "./canvas-reference.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export const findCustomerCatalogMediaData = (
  db: Database,
  id: string,
  customerId: string,
) =>
  db
    .selectFrom("media_assets as m")
    .selectAll("m")
    .where("m.id", "=", id)
    .where("m.source", "=", "upload")
    .where(
      sql<boolean>`EXISTS (
 SELECT 1 FROM packages p JOIN booking_requests br ON br.id=p.custom_for_booking_request_id
 WHERE ${catalogOwnerContainsMedia("p", sql.ref("m.id"))}
 AND p.package_type='custom' AND br.customer_id=${customerId}::uuid
)`,
    )
    .executeTakeFirst();
