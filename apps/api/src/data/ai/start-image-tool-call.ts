import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { z } from "zod";

const imageToolStartSchema = z
  .object({
    turnId: z.string().uuid(),
    imageId: z.string().uuid(),
    conversationId: z.string().uuid(),
    input: z
      .object({
        model: z.string().min(1).max(512).nullable(),
        imageId: z.string().uuid(),
        position: z.number().int().nonnegative(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        byteSize: z.number().int().positive(),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  })
  .strict()
  .refine((value) => value.imageId === value.input.imageId);

export async function startImageToolCallData(
  db: Kysely<DB>,
  value: {
    turnId: string;
    imageId: string;
    conversationId: string;
    input: {
      model: string | null;
      imageId: string;
      position: number;
      mimeType: string;
      byteSize: number;
      contentHash: string;
    };
  },
) {
  const input = imageToolStartSchema.parse(value);
  return db
    .insertInto("ai_tool_calls")
    .values({
      turn_id: input.turnId,
      tool_call_id: input.imageId,
      tool_name: "interpretMessageImage",
      conversation_id: input.conversationId,
      customer_message_id: null,
      input: JSON.stringify(input.input),
      status: "started",
      started_at: sql<Date>`clock_timestamp()`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
}
