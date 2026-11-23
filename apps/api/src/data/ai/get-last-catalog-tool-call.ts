import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  validateLastCatalogToolCall,
  type LastCatalogToolCallInput,
} from "./tool-call-validation.js";

export function getLastCatalogToolCallData(
  db: Kysely<DB>,
  value: LastCatalogToolCallInput,
) {
  const input = validateLastCatalogToolCall(value);

  return db
    .selectFrom("ai_tool_calls as tool_call")
    .innerJoin(
      "messages as reply",
      "reply.id",
      "tool_call.assistant_message_id",
    )
    .innerJoin(
      "messages as trigger_message",
      "trigger_message.id",
      "tool_call.customer_message_id",
    )
    .innerJoin("messages as current_message", (join) =>
      join.on("current_message.id", "=", input.customerMessageId),
    )
    .select([
      "tool_call.input",
      "tool_call.output",
      "reply.body as replyBody",
      "reply.id as replyId",
      "trigger_message.id as triggerMessageId",
    ])
    .select(
      sql<string>`to_char(reply.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || ':' || reply.id::text`.as(
        "replyOrder",
      ),
    )
    .where("tool_call.tool_name", "=", input.toolName)
    .where("tool_call.status", "=", "succeeded")
    .where("tool_call.assistant_message_id", "is not", null)
    .where("current_message.conversation_id", "=", input.conversationId)
    .where("current_message.sender_role", "=", "customer")
    .whereRef(
      "trigger_message.conversation_id",
      "=",
      "current_message.conversation_id",
    )
    .where("trigger_message.sender_role", "=", "customer")
    .whereRef("reply.conversation_id", "=", "current_message.conversation_id")
    .where("reply.sender_role", "=", "assistant")
    .$if(input.toolName === "attachCatalogRecommendations", (query) =>
      query
        .select("reply.catalog_recommendations as recommendations")
        .where("reply.catalog_recommendations", "is not", null)
        .orderBy("reply.created_at", "desc")
        .orderBy("reply.id", "desc"),
    )
    .where(
      sql<boolean>`(trigger_message.created_at, trigger_message.id) < (reply.created_at, reply.id)`,
    )
    .where(
      sql<boolean>`(reply.created_at, reply.id) < (current_message.created_at, current_message.id)`,
    )
    .orderBy("trigger_message.created_at", "desc")
    .orderBy("trigger_message.id", "desc")
    .orderBy("tool_call.started_at", "desc")
    .orderBy("tool_call.id", "desc")
    .limit(1)
    .executeTakeFirst();
}

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
