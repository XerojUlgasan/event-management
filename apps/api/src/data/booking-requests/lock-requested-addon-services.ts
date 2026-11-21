import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function lockRequestedAddonServices(
  trx: Transaction<DB>,
  ids: string[],
) {
  return trx
    .selectFrom("services")
    .select([
      "id",
      "name",
      "updated_at",
      "hourly_rate_pesos",
      "fixed_price_pesos",
      "included_hours",
    ])
    .where("id", "in", ids)
    .where("archived_at", "is", null)
    .orderBy("id")
    .forUpdate()
    .execute();
}
