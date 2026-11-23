import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function listTurnCatalogLookupsData(
  db: Kysely<DB>,
  turnId: string,
  customerMessageId: string,
) {
  return db
    .selectFrom("ai_tool_calls")
    .select((eb) => [
      "tool_name",
      "input",
      eb
        .case()
        .when("tool_name", "=", "searchPublicCatalog")
        .then(eb.ref("output"))
        .end()
        .as("search_output"),
    ])
    .where("turn_id", "=", turnId)
    .where("customer_message_id", "=", customerMessageId)
    .where("status", "=", "succeeded")
    .where("tool_name", "in", ["searchPublicCatalog", "getPublicCatalogItem"])
    .execute();
}
