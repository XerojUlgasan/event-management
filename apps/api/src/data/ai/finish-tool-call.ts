import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  validateFinishToolCall,
  type FinishToolCallInput,
} from "./tool-call-validation.js";

export async function finishToolCallData(
  db: Kysely<DB>,
  value: FinishToolCallInput,
) {
  const input = validateFinishToolCall(value);
  const result = await db
    .updateTable("ai_tool_calls")
    .set({
      status: input.status,
      output: input.output ?? null,
      error_code: input.errorCode ?? null,
      completed_at: sql<Date>`clock_timestamp()`,
    })
    .where("id", "=", input.id)
    .where("status", "=", "started")
    .executeTakeFirst();

  if (result.numUpdatedRows !== 1n)
    throw new Error("AI tool call is missing or already completed");

  return { id: input.id, status: input.status };
}
