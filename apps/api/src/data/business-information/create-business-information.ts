import type { Transaction } from "kysely";
import type { DB, Json } from "../../db/types.js";

export function createBusinessInformationData(
  db: Transaction<DB>,
  information: Json,
) {
  return db
    .insertInto("business_information")
    .values({ id: 1, information })
    .onConflict((conflict) => conflict.column("id").doNothing())
    .returning(["information", "updated_at"])
    .executeTakeFirst();
}
