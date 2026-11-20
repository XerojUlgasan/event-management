import { hasObservedReply } from "../../../../lib/services/messages/pending-replies";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@event-management/ui";

import {
  getAdminConversation,
  getAdminConversations,
  sendAdminMessage,
  retryAdminMessageProcessing,
  updateAdminConversationAi,
  type ChatConversation,
  type ChatThread,
} from "../../../../lib/data/messages/conversations";
import { ApiError } from "../../../../lib/http/request";
import { useConversationList } from "../../../../lib/services/messages/use-conversation-list";
import { assertCursorMoved } from "../../../../lib/services/messages/older-page";
import { conversationLoadError } from "../../../../lib/services/messages/load-error";
import { shouldRefreshAiMetadata } from "../../../../lib/services/messages/realtime-event";
import {
  startVisiblePolling,
  useRealtimeThread,
  useThreadVisible,
} from "../../../../lib/services/messages/use-realtime-thread";
import { MessagesWorkspace } from "../../../messages/MessagesWorkspace";
import {
  addSentMessages,
  mergeAiStateByVersion,
  mergePolledThread,
  prependOlder,
} from "../../../../lib/services/messages/merge-thread";

type ConversationAiState = Pick<
  ChatConversation,
  "aiEnabled" | "aiVersion" | "aiHandoff"
>;

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
  const loadingThreadRequest = useRef<{
    id: string;
    generation: number;
  } | null>(null);
  const threadGeneration = useRef(0);
  const pollingState = useRef({ guest: false, visible: false });
  const reloadRequested = useRef(false);
  const localMessages = useRef(new Set<string>());
  const aiStateByConversation = useRef(new Map<string, ConversationAiState>());

  const rememberAiState = useCallback(
    (id: string, incoming: ConversationAiState) => {
      const next = mergeAiStateByVersion(
        aiStateByConversation.current.get(id) ?? null,
        {
          aiEnabled: incoming.aiEnabled,
          aiVersion: incoming.aiVersion,
          aiHandoff: incoming.aiHandoff,
        },
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
  const replyRevision = useRef(0);
  const successfulPolls = useRef(0);

  const loadThread: (id: string) => Promise<void> = useCallback(
    async (id: string) => {
      if (activeIdRef.current !== id) return;

      if (
        !pollingState.current.guest &&
        (!pollingState.current.visible ||
          document.visibilityState !== "visible")
      )
        return;

      const generation = threadGeneration.current;

      if (
        loadingThreadRequest.current?.id === id &&
        loadingThreadRequest.current.generation === generation
      ) {
        reloadRequested.current = true;

        return;
      }

      const request = { id, generation };
      loadingThreadRequest.current = request;
      const revision = replyRevision.current;
      setLoadingThread(true);

      try {
        const response = await getAdminConversation(id);

        if (
          !mounted.current ||
          activeIdRef.current !== id ||
          generation !== threadGeneration.current ||
          revision !== replyRevision.current
        )
          return;

        successfulPolls.current++;

        const result = {
          ...response,
          conversation: normalizeConversation(response.conversation),
        };
        const unacknowledged = new Set(localMessages.current);
        result.messages.forEach((message) =>
          localMessages.current.delete(message.id),
        );
        setThread((current) => {
          const merged = mergePolledThread(
            current,
            result,
            new Set([...unacknowledged, ...localMessages.current]),
          );

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
        if (
          !mounted.current ||
          activeIdRef.current !== id ||
          generation !== threadGeneration.current
        )
          return;

        const message = conversationLoadError(
          cause,
          "Unable to load or refresh this conversation. Please try again.",
        );
        setThreadError(message);
        const key = `${id}:${message}`;

        if (threadFailure.current !== key) {
          threadFailure.current = key;
          notifyError(message);
        }
      } finally {
        if (loadingThreadRequest.current === request)
          loadingThreadRequest.current = null;

        if (
          mounted.current &&
          activeIdRef.current === id &&
          generation === threadGeneration.current
        ) {
          setLoadingThread(false);

          if (reloadRequested.current) {
            reloadRequested.current = false;
            void loadThread(id);
          }
        }
      }
    },
    [normalizeConversation, notifyError, setConversations],
  );

  const threadVisible = useThreadVisible(conversationOpen);

  const activeConversation =
    thread?.conversation.id === activeId
      ? thread.conversation
      : conversations.find((item) => item.id === activeId);

  const guestThread = activeConversation?.customerId === null;
  const pollingVisibility = guestThread || threadVisible;
  pollingState.current = { guest: guestThread, visible: threadVisible };
  useRealtimeThread({
    id: activeId,
    enabled:
      threadVisible &&
      thread?.conversation.id === activeId &&
      !!thread?.conversation.customerId,
    admin: true,
    onRejoin: () => {
      if (activeId) void loadThread(activeId);
    },
    onMessage: (message) => {
      if (
        document.visibilityState === "visible" &&
        activeId &&
        thread &&
        shouldRefreshAiMetadata(thread.conversation, message)
      )
        void loadThread(activeId);

      localMessages.current.add(message.id);
      setThread((current) =>
        current?.conversation.id === activeId
          ? addSentMessages(current, [message])
          : current,
      );
    },
  });

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
    let stopPolling: () => void;

    if (guestThread) {
      void loadThread(activeId);

      const timer = window.setInterval(() => void loadThread(activeId), 5000);

      stopPolling = () => window.clearInterval(timer);
    } else {
      stopPolling = startVisiblePolling(
        () => void loadThread(activeId),
        pollingVisibility,
      );
    }

    return () => {
      threadGeneration.current++;
      reloadRequested.current = false;
      olderRequest.current++;
      stopPolling();
    };
  }, [activeId, loadThread, pollingVisibility, guestThread]);

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

      assertCursorMoved(older.nextCursor, cursor);
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

  const send = async (body: string, files: File[], requestId: string) => {
    if (!activeId) return;

    const conversationId = activeId;
    const result = await sendAdminMessage(
      conversationId,
      body,
      requestId,
      files,
    );
    const aiState = rememberAiState(conversationId, result);
    localMessages.current.add(result.message.id);
    setThread((current) => {
      if (!current || current.conversation.id !== conversationId)
        return current;

      const merged = addSentMessages(current, [result.message]);

      return {
        ...merged,
        conversation: {
          ...merged.conversation,
          ...mergeAiStateByVersion(current.conversation, aiState),
        },
      };
    });
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
          replyRevision.current++;
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
        onRetryProcessing={async (messageId) => {
          if (!activeId) return;

          const id = activeId;
          const aiVersion = thread?.conversation.aiVersion;
          const pollAtStart = successfulPolls.current;
          const { message } = await retryAdminMessageProcessing(id, messageId);
          replyRevision.current++;
          setThread((current) =>
            current?.conversation.id === id
              ? {
                  ...current,
                  conversation: {
                    ...current.conversation,
                    aiReplyPending:
                      current.conversation.aiReplyPending ||
                      (current.conversation.aiEnabled &&
                        current.conversation.aiVersion === aiVersion &&
                        !!message.processing?.replyPending &&
                        !hasObservedReply(current.messages, messageId) &&
                        !(
                          successfulPolls.current > pollAtStart &&
                          current.messages.some(
                            (item) =>
                              item.id === messageId &&
                              ["completed", "failed", "suppressed"].includes(
                                item.processing?.status ?? "",
                              ),
                          )
                        )),
                  },
                  messages: current.messages.map((item) =>
                    item.id === message.id &&
                    !hasObservedReply(current.messages, messageId) &&
                    !(
                      successfulPolls.current > pollAtStart &&
                      ["completed", "failed", "suppressed"].includes(
                        item.processing?.status ?? "",
                      )
                    )
                      ? message
                      : item,
                  ),
                }
              : current,
          );
        }}
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
