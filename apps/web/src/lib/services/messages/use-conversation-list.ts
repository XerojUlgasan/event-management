import { useCallback, useEffect, useRef, useState } from "react";
import {
  notificationErrorMessage,
  useNotifications,
} from "@event-management/ui";
import type { ChatConversation } from "../../data/messages/conversations";
import {
  appendConversations,
  readRecentConversations,
  refreshConversations,
  type ConversationLoader,
} from "./conversation-pages";
import { assertCursorMoved } from "./older-page";

type Inbox = {
  conversations: ChatConversation[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  moreError: string;
};

/** Shared customer/admin cursor accumulation; polling never replaces loaded history. */
export function useConversationList(load: ConversationLoader, enabled = true) {
  const { notifyError } = useNotifications();
  const [inbox, setInbox] = useState<Inbox>({
    conversations: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: "",
    moreError: "",
  });
  const current = useRef(inbox);
  const epoch = useRef(0);
  const refreshing = useRef(false);
  const appending = useRef(false);
  const failure = useRef("");

  const commit = useCallback((update: (value: Inbox) => Inbox) => {
    current.current = update(current.current);
    setInbox(current.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || refreshing.current) return;

    refreshing.current = true;
    const request = epoch.current;

    try {
      const page = await readRecentConversations(
        load,
        new Map(current.current.conversations.map((item) => [item.id, item])),
      );

      if (request !== epoch.current) return;

      commit((value) => ({
        ...value,
        conversations: refreshConversations(
          value.conversations,
          page.conversations,
        ),
        nextCursor: value.conversations.length
          ? value.nextCursor
          : page.nextCursor,
        error: "",
        loading: false,
      }));
      failure.current = "";
    } catch (cause) {
      if (request !== epoch.current) return;

      const error = notificationErrorMessage(
        cause,
        "Unable to load conversations.",
      );
      commit((value) => ({ ...value, error, loading: false }));

      if (failure.current !== error) notifyError(error);

      failure.current = error;
    } finally {
      if (request === epoch.current) refreshing.current = false;
    }
  }, [load, enabled, commit, notifyError]);

  useEffect(() => {
    void refresh();

    const timer = enabled
      ? window.setInterval(() => void refresh(), 5000)
      : undefined;

    return () => {
      epoch.current++;
      refreshing.current = false;
      appending.current = false;
      commit((value) => ({ ...value, loadingMore: false }));

      if (timer) window.clearInterval(timer);
    };
  }, [enabled, refresh, commit]);

  const loadMore = useCallback(async () => {
    const cursor = current.current.nextCursor;

    if (!enabled || !cursor || appending.current) return;

    appending.current = true;
    const request = epoch.current;
    commit((value) => ({ ...value, loadingMore: true, moreError: "" }));

    try {
      const page = await load(cursor);

      if (request !== epoch.current) return;

      assertCursorMoved(
        page.nextCursor,
        cursor,
        "Unable to load more conversations. Please try again.",
      );
      commit((value) => ({
        ...value,
        conversations: appendConversations(
          value.conversations,
          page.conversations,
        ),
        nextCursor: page.nextCursor,
      }));
    } catch (cause) {
      if (request !== epoch.current) return;

      const moreError = notifyError(
        cause,
        "Unable to load more conversations.",
      );
      commit((value) => ({ ...value, moreError }));
    } finally {
      if (request === epoch.current) {
        appending.current = false;
        commit((value) => ({ ...value, loadingMore: false }));
      }
    }
  }, [load, enabled, commit, notifyError]);

  const setConversations = useCallback(
    (update: (value: ChatConversation[]) => ChatConversation[]) => {
      commit((value) => ({
        ...value,
        conversations: update(value.conversations),
      }));
    },
    [commit],
  );

  return { ...inbox, refresh, loadMore, setConversations };
}
