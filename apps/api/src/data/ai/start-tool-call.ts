import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  validateStartToolCall,
  type StartToolCallInput,
} from "./tool-call-validation.js";

export async function startToolCallData(
  db: Kysely<DB>,
  value: StartToolCallInput,
) {
  const input = validateStartToolCall(value);
  const row = await db
    .insertInto("ai_tool_calls")
    .values({
      turn_id: input.turnId,
      tool_call_id: input.toolCallId,
      tool_name: input.toolName,
      customer_message_id: input.customerMessageId,
      status: "started",
      input: input.input,
      started_at: sql<Date>`clock_timestamp()`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return { id: row.id };
}
