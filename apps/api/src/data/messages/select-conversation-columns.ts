import { type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export function selectConversationColumnsData(db: Database) {
  return db
    .selectFrom("conversations as c")
    .innerJoin("users as customer", "customer.id", "c.customer_id")
    .leftJoin("booking_requests as br", "br.id", "c.booking_request_id")
    .leftJoin("packages as pkg", "pkg.id", "br.package_id")
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
      eb.ref("pkg.name").as("package_name"),
      eb.ref("br.reference").as("booking_request_reference"),
      eb.ref("br.status").as("booking_request_status"),
      eb.ref("br.event_type").as("event_type"),
      eb.ref("br.starts_at").as("event_starts_at"),
      eb.ref("br.ends_at").as("event_ends_at"),
      eb.ref("br.guest_count").as("event_guest_count"),
    ]);
}
