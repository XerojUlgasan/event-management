import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export function selectConversationColumnsData(db: Database) {
  return db
    .selectFrom("conversations as c")
    .innerJoin("users as customer", "customer.id", "c.customer_id")
    .leftJoin("booking_requests as br", "br.id", "c.booking_request_id")
    .leftJoin("booking_arrangements as ba", "ba.booking_request_id", "br.id")
    .select((eb) => [
      "c.id",
      "c.customer_id",
      "c.status",
      "c.closed_at",
      "c.booking_request_id",
      "c.created_at",
      "c.updated_at",
      eb.ref("customer.display_name").as("customer_display_name"),
      eb.ref("customer.email").as("customer_email"),
      eb.ref("br.package_id").as("package_id"),
      eb.ref("br.package_name").as("package_name"),
      eb.ref("br.reference").as("booking_request_reference"),
      eb.ref("br.status").as("booking_request_status"),
      eb.ref("ba.id").as("arrangement_id"),
      eb.ref("ba.event_type").as("arrangement_event_type"),
      eb.ref("ba.starts_at").as("arrangement_starts_at"),
      eb.ref("ba.ends_at").as("arrangement_ends_at"),
      eb.ref("ba.guest_count").as("arrangement_guest_count"),
      sql<boolean>`exists (
        select 1
        from customization_requests cr
        where cr.booking_request_id = br.id
          and cr.status = 'requested'
      )`.as("has_pending_customization"),
    ]);
}
