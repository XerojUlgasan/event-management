import type { Kysely } from "kysely";
import { z } from "@hono/zod-openapi";
import {
  createPage,
  DEFAULT_PAGE_SIZE,
} from "@event-management/contracts/pagination";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "../../data/messages/types.js";
import {
  encodePageCursor,
  parsePageCursor,
  postgresTimestampSchema,
} from "../../utils/pagination.js";
import { markMessagesReadData } from "../../data/messages/mark-messages-read.js";
import { listThreadMessagesData } from "../../data/messages/list-thread-messages.js";
import { listLastMessagesData } from "../../data/messages/list-last-messages.js";
import { messageDto, conversationDto } from "./message-response.js";
const cursorSchema = z.object({
  createdAt: postgresTimestampSchema.and(z.iso.datetime({ precision: 6 })),
  id: z.string().uuid(),
});
export async function getConversationThreadService(
  db: Kysely<DB>,
  conversation: ConversationWithCustomer,
  viewer: "admin" | "customer",
  limit = DEFAULT_PAGE_SIZE,
  cursor?: string,
) {
  const scope = `thread:${conversation.id}`;
  const position = parsePageCursor(cursor, cursorSchema, scope);
  await markMessagesReadData(db, conversation, viewer);
  const fetched = await listThreadMessagesData(
    db,
    conversation.id,
    limit,
    position,
  );
  const page = createPage(fetched, limit, (row) =>
    encodePageCursor(scope, { createdAt: row.cursor_created_at, id: row.id }),
  );
  const latest = cursor
    ? (await listLastMessagesData(db, [conversation.id])).get(conversation.id)
    : page.items[0];
  return {
    conversation: conversationDto(
      conversation,
      latest ? messageDto(latest) : null,
      0,
    ),
    messages: page.items.map(messageDto).reverse(),
    nextCursor: page.nextCursor,
  };
}
