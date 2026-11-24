import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  validateLastCatalogToolCall,
  type LastCatalogToolCallInput,
} from "./tool-call-validation.js";

export function selectDeliveredCatalogToolCallsData(
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
    .select(["tool_call.input", "tool_call.output", "reply.id as replyId"])
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
    .where(
      sql<boolean>`(trigger_message.created_at, trigger_message.id) < (reply.created_at, reply.id)`,
    )
    .where(
      sql<boolean>`(reply.created_at, reply.id) < (current_message.created_at, current_message.id)`,
    );
}
