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
      "c.created_at",
      "c.updated_at",
      eb.ref("customer.display_name").as("customer_display_name"),
      eb.ref("customer.email").as("customer_email"),
    ]);
}

