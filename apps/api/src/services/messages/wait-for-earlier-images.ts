import { setTimeout as delay } from "node:timers/promises";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

// Keep the request bounded even when a worker is unavailable or in retry backoff.
export async function waitForEarlierImages(
  db: Kysely<DB>,
  conversationId: string,
  messageId: string,
  abortSignal?: AbortSignal,
) {
  const signal = AbortSignal.any([
    AbortSignal.timeout(5_000),
    ...(abortSignal ? [abortSignal] : []),
  ]);

  while (true) {
    signal.throwIfAborted();
    const result = await sql<{ pending: boolean }>`select exists (
      select 1 from messages current
      join messages earlier on earlier.conversation_id = current.conversation_id
      join background_jobs j on j.dedupe_key = earlier.id::text
      where current.id = ${messageId}::uuid and current.conversation_id = ${conversationId}::uuid
        and (earlier.created_at, earlier.id) < (current.created_at, current.id)
        and j.type = 'process_image_message' and j.status in ('pending', 'running')
    ) as pending`.execute(db);

    if (!result.rows[0]?.pending) return;

    await delay(200, undefined, { signal });
  }
}
