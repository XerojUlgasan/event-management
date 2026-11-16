import { useCallback, useEffect, useRef, useState } from "react";
import {
  notificationErrorMessage,
  useNotifications,
} from "@event-management/ui";

import {
  getAdminConversation,
  getAdminConversations,
  sendAdminMessage,
  updateAdminConversationAi,
  type ChatConversation,
  type ChatThread,
} from "../../../../lib/data/messages/conversations";
import { ApiError } from "../../../../lib/http/request";
import { useConversationList } from "../../../../lib/services/messages/use-conversation-list";
import { MessagesWorkspace } from "../../../messages/MessagesWorkspace";
import {
  mergeAiStateByVersion,
  mergePolledThread,
  prependOlder,
} from "../../../../lib/services/messages/merge-thread";

type ConversationAiState = Pick<ChatConversation, "aiEnabled" | "aiVersion">;

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
  const aiStateByConversation = useRef(new Map<string, ConversationAiState>());
  const rememberAiState = useCallback(
    (id: string, incoming: ConversationAiState) => {
      const next = mergeAiStateByVersion(
        aiStateByConversation.current.get(id) ?? null,
        { aiEnabled: incoming.aiEnabled, aiVersion: incoming.aiVersion },
      );
      aiStateByConversation.current.set(id, next);
      return next;
    },
    [],
  );
  const normalizeConversation = useCallback(
    (conversation: ChatConversation) => ({
      ...conversation,
      ...rememberAiState(conversation.id, conversation),
    }),
    [rememberAiState],
  );
  const loadConversations = useCallback(
    async (cursor?: string) => {
      const page = await getAdminConversations(cursor);
      return {
        ...page,
        conversations: page.conversations.map(normalizeConversation),
      };
    },
    [normalizeConversation],
  );
  const inbox = useConversationList(loadConversations);
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
  const [aiPending, setAiPending] = useState<Record<string, boolean>>({});
  const aiPendingRef = useRef(new Set<string>());
  const olderRequest = useRef(0);
  const olderPending = useRef(false);

  const loadThread = useCallback(
    async (id: string) => {
      if (loadingThreadId.current === id) return;
      loadingThreadId.current = id;
      setLoadingThread(true);
      try {
        const response = await getAdminConversation(id);
        if (!mounted.current || activeIdRef.current !== id) return;
        const result = {
          ...response,
          conversation: normalizeConversation(response.conversation),
        };
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
          current.map((item) =>
            item.id === id
              ? {
                  ...result.conversation,
                  ...mergeAiStateByVersion(item, result.conversation),
                }
              : item,
          ),
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
    [normalizeConversation, notifyError, setConversations],
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
    const conversationId = activeId;
    const result = await sendAdminMessage(conversationId, body);
    const aiState = rememberAiState(conversationId, result);
    localMessages.current.add(result.message.id);
    setThread((current) =>
      current && current.conversation.id === conversationId
        ? {
            ...current,
            conversation: {
              ...current.conversation,
              ...aiState,
              status: "active",
              lastMessage: result.message,
              updatedAt: result.message.createdAt,
            },
            messages: [...current.messages, result.message],
          }
        : current,
    );
    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId ? { ...item, ...aiState } : item,
      ),
    );
    void inbox.refresh();
  };

  const toggleAi = async (
    id: string,
    aiEnabled: boolean,
    expectedAiVersion: number,
  ) => {
    if (aiPendingRef.current.has(id)) return;
    aiPendingRef.current.add(id);
    setAiPending((current) => ({ ...current, [id]: true }));
    try {
      const result = await updateAdminConversationAi(
        id,
        aiEnabled,
        expectedAiVersion,
      );
      const aiState = rememberAiState(id, result);
      setThread((current) =>
        current && current.conversation.id === id
          ? {
              ...current,
              conversation: { ...current.conversation, ...aiState },
            }
          : current,
      );
      setConversations((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...aiState } : item,
        ),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        try {
          const response = await getAdminConversation(id);
          const result = {
            ...response,
            conversation: normalizeConversation(response.conversation),
          };
          const unacknowledged = new Set(localMessages.current);
          result.messages.forEach((message) =>
            localMessages.current.delete(message.id),
          );
          setThread((current) =>
            current?.conversation.id === id
              ? mergePolledThread(current, result, unacknowledged).thread
              : current,
          );
          setConversations((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...result.conversation,
                    ...mergeAiStateByVersion(item, result.conversation),
                  }
                : item,
            ),
          );
          notifyError(
            new Error(
              "The AI setting changed elsewhere. The current value was refreshed.",
            ),
          );
        } catch (refreshCause) {
          notifyError(
            refreshCause,
            "The AI setting changed, but its current value could not be loaded.",
          );
        }
      } else {
        notifyError(cause, "Unable to update the AI reply setting.");
      }
    } finally {
      aiPendingRef.current.delete(id);
      setAiPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
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
        onToggleAi={toggleAi}
        pendingAiToggle={!!aiPending[activeId ?? ""]}
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
