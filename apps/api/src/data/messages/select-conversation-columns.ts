import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export function selectConversationColumnsData(db: Database) {
  return db
    .selectFrom("conversations as c")
    .innerJoin("users as customer", "customer.id", "c.customer_id")
    .select((eb) => [
      "c.id",
      "c.customer_id",
      "c.package_id",
      "c.event_type",
      "c.event_starts_at",
      "c.event_ends_at",
      "c.guest_count",
      "c.status",
      "c.closed_at",
      "c.guest_chat_id",
      "c.created_at",
      "c.updated_at",
      eb.ref("customer.display_name").as("customer_display_name"),
      eb.ref("customer.email").as("customer_email"),
      eb
        .selectFrom("package_versions as pv")
        .select("pv.name")
        .whereRef("pv.package_id", "=", "c.package_id")
        .where("pv.state", "=", "published")
        .orderBy("pv.published_at", "desc")
        .limit(1)
        .as("package_name"),
    ]);
}
