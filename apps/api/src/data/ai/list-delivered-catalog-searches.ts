import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

/** Only executed searches attached to the exact assistant reply the customer saw. */
export function listDeliveredCatalogSearchesData(
  db: Kysely<DB>,
  replyId: string,
) {
  return db
    .selectFrom("ai_tool_calls")
    .select("output")
    .where("assistant_message_id", "=", replyId)
    .where("tool_name", "=", "searchPublicCatalog")
    .where("status", "=", "succeeded")
    .execute();
}
