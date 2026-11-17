import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  validateLinkToolCalls,
  type LinkToolCallsInput,
} from "./tool-call-validation.js";

export async function linkToolCallsToReplyData(
  db: Kysely<DB>,
  value: LinkToolCallsInput,
) {
  const input = validateLinkToolCalls(value);
  const conflicting = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("turn_id", "=", input.turnId)
    .where("customer_message_id", "=", input.customerMessageId)
    .where("status", "in", ["succeeded", "failed"])
    .where("assistant_message_id", "is not", null)
    .where("assistant_message_id", "!=", input.assistantMessageId)
    .executeTakeFirst();
  if (conflicting)
    throw new Error("AI tool calls are already linked to another reply");

  const result = await db
    .updateTable("ai_tool_calls")
    .set({ assistant_message_id: input.assistantMessageId })
    .where("turn_id", "=", input.turnId)
    .where("customer_message_id", "=", input.customerMessageId)
    .where("status", "in", ["succeeded", "failed"])
    .where("assistant_message_id", "is", null)
    .executeTakeFirst();

  return result.numUpdatedRows;
}
