import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import {
  encodePageCursor,
  parsePageCursor,
  postgresTimestampSchema,
} from "../../utils/pagination.js";
import { listLastMessagesData } from "../../data/messages/list-last-messages.js";
import { listConversationsData } from "../../data/messages/list-conversations.js";
import { countUnreadMessagesData } from "../../data/messages/count-unread-messages.js";
import { messageDto, conversationDto } from "./message-response.js";

const cursorSchema = z.object({
  updatedAt: postgresTimestampSchema.and(z.iso.datetime({ precision: 6 })),
  id: z.string().uuid(),
});
export async function listAdminConversationsService(
  db: Kysely<DB>,
  limit: number,
  cursor?: string,
  customerId?: string,
  reference?: string,
) {
  const scope = customerId
    ? `customer-conversations:${customerId}:${reference ?? ""}`
    : "admin-conversations";
  const position = parsePageCursor(cursor, cursorSchema, scope);
  const fetched = await listConversationsData(
    db,
    limit,
    position,
    customerId,
    reference,
  );
  const page = createPage(fetched, limit, (row) =>
    encodePageCursor(scope, { updatedAt: row.cursor_updated_at, id: row.id }),
  );
  const ids = page.items.map((row) => row.id);
  const [last, unread] = await Promise.all([
    listLastMessagesData(db, ids),
    countUnreadMessagesData(db, ids, customerId ? "customer" : "admin"),
  ]);
  return {
    conversations: page.items.map((row) => {
      const latest = last.get(row.id);
      return conversationDto(
        row,
        latest ? messageDto(latest) : null,
        unread.get(row.id) ?? 0,
        customerId ? "customer" : "admin",
      );
    }),
    nextCursor: page.nextCursor,
  };
}
