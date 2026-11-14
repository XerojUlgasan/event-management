import { useCallback, useEffect, useRef, useState } from "react";
import {
  notificationErrorMessage,
  useNotifications,
} from "@event-management/ui";

import {
  getAdminConversation,
  getAdminConversations,
  sendAdminMessage,
  type ChatThread,
} from "../../../../lib/data/messages/conversations";
import { useConversationList } from "../../../../lib/services/messages/use-conversation-list";
import { MessagesWorkspace } from "../../../messages/MessagesWorkspace";
import {
  mergePolledThread,
  prependOlder,
} from "../../../../lib/services/messages/merge-thread";

export function MessagesPage() {
  const { notifyError } = useNotifications();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const threadFailure = useRef("");
  const activeIdRef = useRef<string | null>(null);
  const loadingThreadId = useRef<string | null>(null);
  const localMessages = useRef(new Set<string>());
  const inbox = useConversationList(getAdminConversations);
  const { conversations, setConversations } = inbox;
  const [activeId, setActiveId] = useState<string | null>(null);
  activeIdRef.current = activeId;
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [conversationOpen, setConversationOpen] = useState(false);
  const [historyNotice, setHistoryNotice] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const olderRequest = useRef(0);
  const olderPending = useRef(false);

  const loadThread = useCallback(
    async (id: string) => {
      if (loadingThreadId.current === id) return;
      loadingThreadId.current = id;
      setLoadingThread(true);
      try {
        const result = await getAdminConversation(id);
        if (!mounted.current || activeIdRef.current !== id) return;
        const unacknowledged = new Set(localMessages.current);
        result.messages.forEach((message) =>
          localMessages.current.delete(message.id),
        );
        setThread((current) => {
          const merged = mergePolledThread(current, result, unacknowledged);
          if (merged.gap)
            setHistoryNotice(
              "New messages arrived while you were away. Earlier history was reset; scroll up to see it.",
            );
          return merged.thread;
        });
        setConversations((current) =>
          current.map((item) => (item.id === id ? result.conversation : item)),
        );
        setThreadError("");
        threadFailure.current = "";
      } catch (cause) {
        if (!mounted.current || activeIdRef.current !== id) return;
        const message = notificationErrorMessage(
          cause,
          "Unable to load this conversation.",
        );
        setThreadError(message);
        const key = `${id}:${message}`;
        if (threadFailure.current !== key) {
          threadFailure.current = key;
          notifyError(message);
        }
      } finally {
        if (loadingThreadId.current === id) loadingThreadId.current = null;
        if (mounted.current && activeIdRef.current === id)
          setLoadingThread(false);
      }
    },
    [notifyError, setConversations],
  );

  useEffect(() => {
    olderRequest.current++;
    olderPending.current = false;
    setLoadingOlder(false);
    setOlderError("");
    if (!activeId) {
      setThread(null);
      return;
    }
    setThread((current) =>
      current?.conversation.id === activeId ? current : null,
    );
    void loadThread(activeId);
    const timer = window.setInterval(() => void loadThread(activeId), 5000);
    return () => {
      olderRequest.current++;
      window.clearInterval(timer);
    };
  }, [activeId, loadThread]);

  useEffect(() => {
    if (activeId || conversations.length === 0) return;
    if (window.matchMedia("(min-width: 761px)").matches)
      setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const loadOlder = async () => {
    if (!activeId || !thread?.nextCursor || olderPending.current) return;
    const id = activeId;
    const cursor = thread.nextCursor;
    const request = ++olderRequest.current;
    olderPending.current = true;
    setLoadingOlder(true);
    setOlderError("");
    try {
      const older = await getAdminConversation(id, cursor);
      if (
        !mounted.current ||
        request !== olderRequest.current ||
        activeIdRef.current !== id
      )
        return;
      if (older.nextCursor === cursor)
        throw new Error("Unable to load older messages. Please try again.");
      older.messages.forEach((message) =>
        localMessages.current.delete(message.id),
      );
      setThread((current) =>
        current?.conversation.id === id && current.nextCursor === cursor
          ? prependOlder(current, older)
          : current,
      );
    } catch (cause) {
      if (mounted.current && request === olderRequest.current)
        setOlderError(notifyError(cause, "Unable to load older messages."));
    } finally {
      if (mounted.current && request === olderRequest.current) {
        olderPending.current = false;
        setLoadingOlder(false);
      }
    }
  };

  const send = async (body: string) => {
    if (!activeId) return;
    const result = await sendAdminMessage(activeId, body);
    localMessages.current.add(result.message.id);
    setThread((current) =>
      current && current.conversation.id === activeId
        ? {
            ...current,
            conversation: {
              ...current.conversation,
              status: "active",
              lastMessage: result.message,
              updatedAt: result.message.createdAt,
            },
            messages: [...current.messages, result.message],
          }
        : current,
    );
    void inbox.refresh();
  };

  return (
    <div className="content-stack admin-messages">
      <MessagesWorkspace
        title="Messages"
        viewerRole="admin"
        conversations={conversations}
        activeConversation={thread?.conversation}
        conversationFeed={{
          hasMore: !!inbox.nextCursor,
          pending: inbox.loadingMore,
          error: inbox.moreError,
          onLoadMore: () => void inbox.loadMore(),
        }}
        activeId={activeId}
        onSelect={(id) => {
          setHistoryNotice("");
          setActiveId(id);
          setConversationOpen(true);
        }}
        messages={thread?.messages ?? []}
        hasOlder={!!thread?.nextCursor}
        loadingOlder={loadingOlder}
        olderError={olderError}
        onLoadOlder={() => void loadOlder()}
        historyNotice={historyNotice}
        loading={
          (inbox.loading && !conversations.length) ||
          loadingThread ||
          (!!activeId && thread?.conversation.id !== activeId)
        }
        error={inbox.error || threadError}
        onRetry={() => {
          void inbox.refresh();
          if (activeId) void loadThread(activeId);
        }}
        sendDisabled={thread?.conversation.id !== activeId || !!threadError}
        onSend={send}
        onBack={() => {
          setConversationOpen(false);
          setActiveId(null);
          setThread(null);
        }}
        conversationOpen={conversationOpen}
        readOnly={thread?.conversation.status === "closed"}
        listEmpty={{
          title: "No conversations yet",
          body: "Customer conversations will appear here when they are created.",
        }}
        threadEmpty={{
          title: "No messages yet",
          body: "Messages will appear here when the customer or team writes.",
        }}
      />
    </div>
  );
}
