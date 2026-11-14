import { sql } from "kysely";
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
 SELECT 1 FROM catalog_widgets w JOIN catalog_sections s ON s.id=w.section_id JOIN catalog_pages cp ON cp.id=s.page_id
 JOIN packages p ON p.id=cp.package_id JOIN booking_requests br ON br.id=p.custom_for_booking_request_id
 WHERE w.media_id=m.id AND p.package_type='custom' AND br.customer_id=${customerId}::uuid
)`,
    )
    .executeTakeFirst();
