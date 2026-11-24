import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { selectDeliveredCatalogToolCallsData } from "./select-delivered-catalog-tool-calls.js";
import type { LastCatalogToolCallInput } from "./tool-call-validation.js";

export function getLastCatalogToolCallData(
  db: Kysely<DB>,
  value: LastCatalogToolCallInput,
) {
  return selectDeliveredCatalogToolCallsData(db, value)
    .select([
      "reply.body as replyBody",
      "trigger_message.id as triggerMessageId",
    ])
    .select(
      sql<string>`to_char(reply.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || ':' || reply.id::text`.as(
        "replyOrder",
      ),
    )
    .$if(value.toolName === "attachCatalogRecommendations", (query) =>
      query
        .select("reply.catalog_recommendations as recommendations")
        .where("reply.catalog_recommendations", "is not", null)
        .orderBy("reply.created_at", "desc")
        .orderBy("reply.id", "desc"),
    )
    .orderBy("trigger_message.created_at", "desc")
    .orderBy("trigger_message.id", "desc")
    .orderBy("tool_call.started_at", "desc")
    .orderBy("tool_call.id", "desc")
    .limit(1)
    .executeTakeFirst();
}
