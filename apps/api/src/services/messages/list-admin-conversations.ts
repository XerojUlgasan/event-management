import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listLastMessagesData } from "../../data/messages/list-last-messages.js";
import { listConversationsData } from "../../data/messages/list-conversations.js";
import { countUnreadMessagesData } from "../../data/messages/count-unread-messages.js";

import { messageDto, conversationDto } from "./message-response.js";
import { z } from "@hono/zod-openapi";

const cursorDataSchema = z.object({
  updatedAt: z.iso.datetime({ precision: 6 }),
  id: z.string().uuid(),
});

export function decodeAdminConversationsCursor(cursor: string) {
  try {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) return undefined;
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") !== cursor) return undefined;
    const result = cursorDataSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export async function listAdminConversationsService(db: Kysely<DB>, cursor?: { updatedAt: string; id: string }) {
  const fetched = await listConversationsData(db, cursor);
  const rows = fetched.slice(0, 15);
  const ids = rows.map((row) => row.id);
  const [last, unread] = await Promise.all([
    listLastMessagesData(db, ids),
    countUnreadMessagesData(db, ids, "admin"),
  ]);
  const conversations = rows.map((row) => {
    const latest = last.get(row.id);
    return conversationDto(row, latest ? messageDto(latest) : null, unread.get(row.id) ?? 0);
  });
  const lastRow = rows.at(-1);
  const nextCursor = fetched.length > 15 && lastRow
    ? Buffer.from(JSON.stringify({ updatedAt: lastRow.cursor_updated_at, id: lastRow.id })).toString("base64url")
    : null;
  return { conversations, nextCursor };
}
