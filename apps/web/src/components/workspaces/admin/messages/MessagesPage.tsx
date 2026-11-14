import { useCallback, useEffect, useRef, useState } from "react";
import {
  notificationErrorMessage,
  useNotifications,
} from "@event-management/ui";

import {
  getAdminConversation,
  getAdminConversations,
  sendAdminMessage,
  type ChatConversation,
  type ChatThread,
} from "../../../../lib/data/messages/conversations";
import { usePagination } from "../../../../lib/pagination/use-pagination";
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
  const listFailure = useRef("");
  const threadFailure = useRef("");
  const activeIdRef = useRef<string | null>(null);
  const loadingThreadId = useRef<string | null>(null);
  const localMessages = useRef(new Set<string>());
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  activeIdRef.current = activeId;
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [listError, setListError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [conversationOpen, setConversationOpen] = useState(false);
  const pagination = usePagination("admin-conversations");
  const [listRevision, setListRevision] = useState(0);
  const listRequest = useRef(0);
  const [historyNotice, setHistoryNotice] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);

  const loadList = useCallback(async () => {
    const request = ++listRequest.current;
    try {
      const result = await getAdminConversations(pagination.cursor);
      if (!mounted.current || request !== listRequest.current) return;
      setConversations(result.conversations);
      setNextCursor(result.nextCursor);
      setListError("");
      listFailure.current = "";
    } catch (cause) {
      if (!mounted.current || request !== listRequest.current) return;
      const message = notificationErrorMessage(
        cause,
        "Unable to load conversations.",
      );
      setListError(message);
      if (listFailure.current !== message) {
        listFailure.current = message;
        notifyError(message);
      }
    } finally {
      if (mounted.current && request === listRequest.current)
        setLoadingList(false);
    }
  }, [notifyError, pagination.cursor]);

  useEffect(() => {
    setLoadingList(true);
    void loadList();
    const timer =
      pagination.page === 1
        ? window.setInterval(() => void loadList(), 5000)
        : undefined;
    return () => {
      listRequest.current++;
      if (timer) window.clearInterval(timer);
    };
  }, [loadList, pagination.page, listRevision]);

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
              "New messages arrived while you were away. Earlier history was reset; load older messages to see it.",
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
    [notifyError],
  );

  useEffect(() => {
    if (!activeId) {
      setThread(null);
      return;
    }
    setThread((current) =>
      current?.conversation.id === activeId ? current : null,
    );
    void loadThread(activeId);
    const timer = window.setInterval(() => void loadThread(activeId), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, loadThread]);

  useEffect(() => {
    if (activeId || conversations.length === 0) return;
    if (window.matchMedia("(min-width: 601px)").matches)
      setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const loadOlder = async () => {
    if (!activeId || !thread?.nextCursor || loadingOlder) return;
    const id = activeId;
    setLoadingOlder(true);
    try {
      const older = await getAdminConversation(id, thread.nextCursor);
      older.messages.forEach((message) =>
        localMessages.current.delete(message.id),
      );
      setThread((current) =>
        current?.conversation.id === id
          ? prependOlder(current, older)
          : current,
      );
    } catch (cause) {
      notifyError(cause, "Unable to load older messages.");
    } finally {
      setLoadingOlder(false);
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
    if (pagination.page === 1) void loadList();
  };

  return (
    <div className="content-stack admin-messages">
      <MessagesWorkspace
        title="Messages"
        viewerRole="admin"
        conversations={conversations}
        activeConversation={thread?.conversation}
        listPage={{
          page: pagination.page,
          hasNextPage: !!nextCursor,
          pending: loadingList,
          onPrevious: () => {
            setLoadingList(true);
            pagination.previous();
          },
          onNext: () => {
            setLoadingList(true);
            pagination.next(nextCursor);
          },
          onRefresh: () => {
            setLoadingList(true);
            pagination.reset();
            setListRevision((value) => value + 1);
          },
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
        onLoadOlder={() => void loadOlder()}
        historyNotice={historyNotice}
        loading={
          (loadingList && !conversations.length) ||
          loadingThread ||
          (!!activeId && thread?.conversation.id !== activeId)
        }
        error={listError || threadError}
        onRetry={() => {
          if (activeId) {
            void loadThread(activeId);
          } else {
            setLoadingList(true);
            void loadList();
          }
        }}
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
