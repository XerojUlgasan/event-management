import type { ChatConversation } from "../../data/messages/conversations";
import { mergeAiStateByVersion } from "./merge-thread";

/** Preserve server order (including sub-millisecond ties), with one row per ID. */
export function appendConversations(
  current: ChatConversation[],
  older: ChatConversation[],
) {
  const known = new Set(current.map((item) => item.id));
  return [
    ...current,
    ...older.filter((item) => {
      if (known.has(item.id)) return false;
      known.add(item.id);
      return true;
    }),
  ];
}

export function refreshConversations(
  current: ChatConversation[],
  recent: ChatConversation[],
) {
  const known = new Map(current.map((item) => [item.id, item]));
  return appendConversations(
    recent.map((item) =>
      mergeAiStateByVersion(known.get(item.id) ?? null, item),
    ),
    current,
  );
}

type ConversationPage = {
  conversations: ChatConversation[];
  nextCursor: string | null;
};
export type ConversationLoader = (cursor?: string) => Promise<ConversationPage>;

/** Bridge new activity until an unchanged row joins the already-loaded inbox. */
export async function readRecentConversations(
  load: ConversationLoader,
  known: ReadonlyMap<string, ChatConversation>,
): Promise<ConversationPage> {
  let cursor: string | undefined;
  let conversations: ChatConversation[] = [];
  const cursors = new Set<string>();
  while (true) {
    const page = await load(cursor);
    conversations = appendConversations(conversations, page.conversations);
    if (
      !known.size ||
      !page.nextCursor ||
      page.conversations.some((item) => {
        const previous = known.get(item.id);
        return (
          previous?.updatedAt === item.updatedAt &&
          previous?.lastMessage?.id === item.lastMessage?.id
        );
      })
    )
      return { conversations, nextCursor: page.nextCursor };
    if (cursors.has(page.nextCursor))
      throw new Error("Unable to refresh conversations. Please try again.");
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
