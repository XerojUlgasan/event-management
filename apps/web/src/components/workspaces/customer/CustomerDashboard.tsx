import {
  reconcileSubmissionRetries,
  retryableSubmissionError,
} from "../../../lib/services/messages/booking-review";
import { ApiError } from "../../../lib/http/request";
import { navigateWorkspace } from "../../../lib/navigation/workspace-navigation";
import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Brand,
  Button,
  Icon,
  type IconName,
  PageHeader,
  Panel,
  useNotifications,
} from "@event-management/ui";

import { NotificationBell } from "../../notifications/NotificationBell";
import { photos } from "../../../demo/catalog/photos";
import { BookingList } from "../../booking-requests/BookingList";
import { CustomerCatalogPage } from "./catalog/CustomerCatalogPage";
import { CustomerHomeNextStep } from "./home/CustomerHomeNextStep";
import { BookingRequestDialog } from "../../booking-requests/BookingRequestDialog";
import { initialsFromName } from "../../../lib/utils/formatting/name";
import { SignInMethods } from "../../auth/SignInMethods";
import { useConversationList } from "../../../lib/services/messages/use-conversation-list";
import {
  hasLocalReplyPending,
  hasObservedReply,
  reconcilePendingReplies,
} from "../../../lib/services/messages/pending-replies";
import { assertCursorMoved } from "../../../lib/services/messages/older-page";
import { conversationLoadError } from "../../../lib/services/messages/load-error";
import { shouldRefreshAiMetadata } from "../../../lib/services/messages/realtime-event";
import {
  startVisiblePolling,
  useRealtimeThread,
  useThreadVisible,
} from "../../../lib/services/messages/use-realtime-thread";
import { MessagesWorkspace } from "../../messages/MessagesWorkspace";
import {
  addSentMessages,
  addSentMessagesToConversation,
  mergePolledThread,
  prependOlder,
} from "../../../lib/services/messages/merge-thread";
import { readBookingDraft } from "../../../lib/services/booking-requests/booking-draft";
import {
  getPackageBySlug,
  type PublicPackage,
} from "../../../lib/data/catalog/packages";
import {
  createMyConversation,
  getMyConversations,
  getMyConversationById,
  sendMyMessage,
  retryMyMessageProcessing,
  type ChatMessage,
  type ChatConversation,
  type ChatThread,
} from "../../../lib/data/messages/conversations";

import {
  customerPaths,
  customerTab,
  normalizePath,
  type CustomerTab,
} from "../../app/routes";

export function CustomerDashboard({
  path,
  search,
  onPublic,
  profileId,
  userName,
  userEmail,
  onSignOut,
}: {
  path: string;
  search: string;
  onPublic: () => void;
  profileId: string;
  userName: string;
  userEmail: string;
  onSignOut: () => void;
}) {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  const localMessages = useRef(new Set<string>());
  const localFiles = useRef(new Map<string, File[]>());
  const replyRevision = useRef(0);
  const successfulPolls = useRef(0);
  const [pendingReplies, setPendingReplies] = useState<
    Record<string, { conversationId: string; aiVersion: number }>
  >({});
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("clemora-message-sent") === "1") {
        sessionStorage.removeItem("clemora-message-sent");
        notify("Message sent.");
      }
    } catch {
      /* The saved message remains visible in the conversation. */
    }
  }, [notify]);
  const tab = customerTab(path);

  const go = (next: CustomerTab) => {
    navigateWorkspace(customerPaths[next]);
  };

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [mobilePane, setMobilePane] = useState<"inbox" | "thread" | null>(null);
  const [outbox, setOutbox] = useState<
    Record<
      string,
      {
        conversationId: string;
        message: ChatMessage;
        failed: boolean;
        error?: string;
      }
    >
  >({});
  const [messageThread, setMessageThread] = useState<ChatThread | null>(null);
  const inbox = useConversationList(getMyConversations, tab === "Messages");
  const {
    conversations: messageConversations,
    setConversations: setMessageConversations,
    loading: messagesLoading,
    error: messagesError,
  } = inbox;
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const selectedConversationRef = useRef(selectedConversationId);
  selectedConversationRef.current = selectedConversationId;
  const pendingBookingReference = new URLSearchParams(search).get("request");
  const requestedConversation = new URLSearchParams(search).get("conversation");
  const requestedQuotation = new URLSearchParams(search).get("quotation");
  const routeConversation = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== "Messages") {
      routeConversation.current = null;

      return;
    }

    if (!requestedConversation && !routeConversation.current) return;

    routeConversation.current = requestedConversation;
    referenceSelection.current++;
    setSelectedConversationId(requestedConversation);
    setMobilePane(requestedConversation ? "thread" : "inbox");
  }, [tab, requestedConversation, requestedQuotation]);

  const [bookingItem, setBookingItem] = useState<PublicPackage | null>(() =>
    new URLSearchParams(search).get("booking") === "resume"
      ? (readBookingDraft()?.item ?? null)
      : null,
  );

  const [bookingResume, setBookingResume] = useState(
    () => new URLSearchParams(search).get("booking") === "resume",
  );

  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [newChatBusy, setNewChatBusy] = useState(false);
  const [threadRevision, setThreadRevision] = useState(0);
  const handledReference = useRef<string | null>(null);
  const referenceSelection = useRef(0);
  const [referenceAttempt, setReferenceAttempt] = useState(0);
  const [historyNotice, setHistoryNotice] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const olderRequest = useRef(0);
  const olderPending = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const slug = params.get("book");
    const resume = params.get("booking") === "resume";

    if (resume) {
      setBookingItem(readBookingDraft()?.item ?? null);
      setBookingResume(true);

      return;
    }

    setBookingItem(null);
    setBookingResume(false);

    if (!slug) return;

    let active = true;
    getPackageBySlug(slug)
      .then((item) => {
        if (active) {
          setBookingItem(item);
          setBookingResume(false);
        }
      })
      .catch((cause) => {
        if (active) {
          setBookingItem(null);
          notifyError(cause, "Unable to open the selected package.");
        }
      });

    return () => {
      active = false;
    };
  }, [search, notifyError]);

  useEffect(() => {
    if (tab !== "Messages") return;

    if (
      pendingBookingReference &&
      handledReference.current !== pendingBookingReference
    )
      return;

    if (
      !requestedConversation &&
      !selectedConversationId &&
      messageConversations[0]
    )
      setSelectedConversationId(messageConversations[0].id);
  }, [
    tab,
    pendingBookingReference,
    requestedConversation,
    selectedConversationId,
    messageConversations,
  ]);

  useEffect(() => {
    if (
      tab !== "Messages" ||
      !pendingBookingReference ||
      handledReference.current === pendingBookingReference
    )
      return;

    let active = true;
    const selection = referenceSelection.current;
    getMyConversations(undefined, pendingBookingReference)
      .then((result) => {
        if (!active || selection !== referenceSelection.current) return;

        handledReference.current = pendingBookingReference;
        setSelectedConversationId(
          result.conversations[0]?.id ?? messageConversations[0]?.id ?? null,
        );

        if (result.conversations.length) setMobilePane("thread");
      })
      .catch((cause) => {
        if (active && selection === referenceSelection.current)
          setThreadError(
            notifyError(cause, "Unable to find this booking conversation."),
          );
      });

    return () => {
      active = false;
    };
  }, [tab, pendingBookingReference, notifyError, referenceAttempt]);

  const singleConversation =
    messageConversations.length === 1 &&
    messageConversations[0]?.id === selectedConversationId &&
    !inbox.nextCursor;
  const conversationOpen = mobilePane
    ? mobilePane === "thread"
    : singleConversation;
  const threadVisible = useThreadVisible(conversationOpen);
  const pollingVisible = useRef(false);
  pollingVisible.current = tab === "Messages" && threadVisible;

  const refreshThread = useRef<() => void>(() => {});

  useRealtimeThread({
    id: selectedConversationId,
    enabled:
      tab === "Messages" &&
      threadVisible &&
      messageThread?.conversation.id === selectedConversationId,
    admin: false,
    onRejoin: () => refreshThread.current(),
    onMessage: (message) => {
      if (
        document.visibilityState === "visible" &&
        messageThread &&
        shouldRefreshAiMetadata(messageThread.conversation, message)
      )
        refreshThread.current();

      localMessages.current.add(message.id);
      setMessageThread((current) =>
        addSentMessagesToConversation(current, selectedConversationId!, [
          message,
        ]),
      );
      setPendingReplies((current) =>
        messageThread
          ? reconcilePendingReplies(current, messageThread.conversation, [
              message,
            ])
          : current,
      );
      setOutbox((current) => reconcileSubmissionRetries(current, [message]));
    },
  });

  useEffect(() => {
    if (tab !== "Messages" || !selectedConversationId) return;

    let active = true;
    let inFlight = false;
    let reloadRequested = false;
    const id = selectedConversationId;
    olderRequest.current++;
    olderPending.current = false;
    setLoadingOlder(false);
    setOlderError("");
    setThreadLoading(true);
    setMessageThread((current) =>
      current?.conversation.id === id ? current : null,
    );

    const load = async () => {
      if (
        !active ||
        selectedConversationRef.current !== id ||
        !pollingVisible.current ||
        document.visibilityState !== "visible"
      )
        return;

      if (inFlight) {
        reloadRequested = true;

        return;
      }

      inFlight = true;
      const revision = replyRevision.current;

      try {
        const thread = await getMyConversationById(id);

        if (!active || revision !== replyRevision.current) return;

        successfulPolls.current++;
        setPendingReplies((current) =>
          reconcilePendingReplies(
            current,
            thread.conversation,
            thread.messages,
          ),
        );
        const unacknowledged = new Set(localMessages.current);
        setOutbox((current) =>
          reconcileSubmissionRetries(current, thread.messages),
        );
        thread.messages.forEach((message) =>
          localMessages.current.delete(message.id),
        );
        setMessageThread((current) => {
          const merged = mergePolledThread(
            current,
            thread,
            new Set([...unacknowledged, ...localMessages.current]),
          );

          if (merged.gap)
            setHistoryNotice(
              "New messages arrived while you were away. Earlier history was reset; scroll up to see it.",
            );

          return merged.thread;
        });
        setThreadError("");
        setMessageConversations((current) =>
          current.map((item) => (item.id === id ? thread.conversation : item)),
        );
      } catch (cause) {
        if (active)
          setThreadError(
            conversationLoadError(
              cause,
              "Unable to load or refresh this conversation. Please try again.",
            ),
          );
      } finally {
        inFlight = false;

        if (active) {
          setThreadLoading(false);

          if (reloadRequested) {
            reloadRequested = false;
            void load();
          }
        }
      }
    };

    refreshThread.current = () => void load();
    const stopPolling = startVisiblePolling(
      refreshThread.current,
      threadVisible,
    );

    return () => {
      active = false;
      olderRequest.current++;
      refreshThread.current = () => {};
      stopPolling();
    };
  }, [
    tab,
    selectedConversationId,
    notifyError,
    threadRevision,
    setMessageConversations,
    threadVisible,
  ]);

  const showSentInList = (
    conversation: ChatConversation,
    message: ChatMessage,
    sent: ChatMessage[],
  ) => {
    setMessageConversations((current) =>
      current.map((item) =>
        item.id === conversation.id &&
        (!item.lastMessage ||
          item.lastMessage.createdAt < message.createdAt ||
          (item.lastMessage.createdAt === message.createdAt &&
            sent.some(
              (sentMessage) => sentMessage.id === item.lastMessage?.id,
            )))
          ? {
              ...item,
              lastMessage: message,
              updatedAt: message.createdAt,
            }
          : item,
      ),
    );
  };

  const appendMessages = (messages: ChatMessage[], conversationId: string) => {
    setMessageThread((current) =>
      addSentMessagesToConversation(current, conversationId, messages),
    );
  };

  const loadOlder = async () => {
    if (!messageThread?.nextCursor || olderPending.current) return;

    const id = messageThread.conversation.id;
    const cursor = messageThread.nextCursor;
    const request = ++olderRequest.current;
    olderPending.current = true;
    setLoadingOlder(true);
    setOlderError("");

    try {
      const older = await getMyConversationById(id, cursor);

      if (!mounted.current || request !== olderRequest.current) return;

      assertCursorMoved(older.nextCursor, cursor);
      older.messages.forEach((message) =>
        localMessages.current.delete(message.id),
      );
      setMessageThread((current) =>
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

  const deliverMessage = async (
    conversation: ChatConversation,
    message: ChatMessage,
  ) => {
    if (conversation.aiEnabled)
      setPendingReplies((current) => ({
        ...current,
        [message.id]: {
          conversationId: conversation.id,
          aiVersion: conversation.aiVersion,
        },
      }));

    if (message.pendingFiles?.length)
      localFiles.current.set(message.id, message.pendingFiles);

    setOutbox((current) => ({
      ...current,
      [message.id]: {
        conversationId: conversation.id,
        message,
        failed: false,
      },
    }));
    localMessages.current.add(message.id);

    try {
      const result = await sendMyMessage(
        message.body,
        conversation.id,
        message.id,
        message.pendingFiles ?? [],
        message.reviewMessageId,
      );
      replyRevision.current++;

      if (result.message.processing?.replyPending)
        setMessageThread((current) =>
          current?.conversation.id === conversation.id &&
          current.conversation.aiEnabled &&
          current.conversation.aiVersion === conversation.aiVersion &&
          !hasObservedReply(current.messages, message.id) &&
          !current.messages.some(
            (item) =>
              item.id === message.id &&
              ["completed", "failed", "suppressed"].includes(
                item.processing?.status ?? "",
              ),
          )
            ? {
                ...current,
                conversation: { ...current.conversation, aiReplyPending: true },
              }
            : current,
        );

      const sent = result.assistantMessage
        ? [result.message, result.assistantMessage]
        : [result.message];
      sent.forEach((item) => localMessages.current.add(item.id));
      appendMessages(sent, conversation.id);
      setOutbox((current) => {
        if (!current[message.id]) return current;

        if (retryableSubmissionError(message, result.assistantError))
          return {
            ...current,
            [message.id]: {
              conversationId: conversation.id,
              message,
              failed: true,
              error:
                "Your message was saved, but the AI reply could not be completed.",
            },
          };

        if (message.reviewMessageId) {
          const next = { ...current };
          delete next[message.id];

          return next;
        }

        return {
          ...current,
          [message.id]: { ...current[message.id], message: result.message },
        };
      });
      showSentInList(
        conversation,
        result.assistantMessage ?? result.message,
        sent,
      );

      if (message.reviewMessageId) {
        setThreadRevision((value) => value + 1);
        void inbox.refresh();
      }

      if (result.assistantError) notifyError(new Error(result.assistantError));
    } catch (cause) {
      const error =
        message.pendingFiles?.length &&
        cause instanceof ApiError &&
        [400, 413].includes(cause.status)
          ? cause.message
          : undefined;
      setOutbox((current) =>
        current[message.id]
          ? {
              ...current,
              [message.id]: { ...current[message.id], failed: true, error },
            }
          : current,
      );
    } finally {
      setPendingReplies((current) => {
        const next = { ...current };
        delete next[message.id];

        return next;
      });
    }
  };

  const sendMessage = async (
    body: string,
    files: File[] = [],
    requestId: string = crypto.randomUUID(),
    reviewMessageId?: string,
    thread = messageThread,
  ) => {
    const conversation = thread?.conversation;

    if (!conversation) return;

    const message: ChatMessage = {
      id: requestId,
      body,
      pendingFiles: files,
      reviewMessageId,
      quotationId: null,
      senderId: conversation.customerId,
      senderRole: "customer",
      senderName: userName,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    await deliverMessage(conversation, message);
  };

  const startNewChat = async () => {
    if (newChatBusy) return;

    const selection = ++referenceSelection.current;
    handledReference.current = pendingBookingReference;
    setNewChatBusy(true);

    try {
      const thread = await createMyConversation();
      void inbox.refresh();

      if (
        selection !== referenceSelection.current ||
        normalizePath(window.location.pathname) !== customerPaths.Messages
      )
        return;

      if (routeConversation.current) {
        routeConversation.current = null;
        navigateWorkspace(customerPaths.Messages, true);
      }

      setSelectedConversationId(thread.conversation.id);
      setMessageThread(thread);
      setMobilePane("thread");
      notify("New chat started.");
    } catch (cause) {
      notifyError(cause, "Unable to start a new chat.");
    } finally {
      setNewChatBusy(false);
    }
  };

  const selectConversation = (id: string) => {
    referenceSelection.current++;
    handledReference.current = pendingBookingReference;
    setHistoryNotice("");
    setThreadError("");
    setSelectedConversationId(id);
    setMobilePane("thread");
  };

  useEffect(() => {
    if (!accountMenuOpen) return;

    const closeOnOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setAccountMenuOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        accountTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);
  const customerTabs: { label: CustomerTab; icon: IconName }[] = [
    { label: "Home", icon: "grid" },
    { label: "My events", icon: "calendar" },
    { label: "Catalogs", icon: "box" },
    { label: "Messages", icon: "users" },
  ];

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <Button
          variant="plain"
          className="customer-brand-button"
          onClick={onPublic}
        >
          <Brand />
        </Button>
        <nav className="customer-nav" aria-label="Customer workspace">
          {customerTabs.map((item) => (
            <Button
              variant="plain"
              className={tab === item.label ? "active" : ""}
              key={item.label}
              aria-current={tab === item.label ? "page" : undefined}
              onClick={() => go(item.label)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="customer-header-actions">
          <NotificationBell key={profileId} profileId={profileId} />
          <div className="customer-account-menu" ref={accountMenuRef}>
            <Button
              variant="plain"
              type="button"
              ref={accountTriggerRef}
              className="customer-profile account-menu-trigger"
              aria-label={`Account menu for ${userName}`}
              aria-expanded={accountMenuOpen}
              aria-controls="customer-account-menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <Avatar initials={initialsFromName(userName)} />
              <span>
                <strong>{userName}</strong>
                <small>Customer</small>
              </span>
              <Icon name="chevron" size={14} />
            </Button>
            {accountMenuOpen && (
              <div className="account-menu" id="customer-account-menu">
                <Button
                  variant="plain"
                  type="button"
                  onClick={() => {
                    go("Profile");
                    setAccountMenuOpen(false);
                  }}
                >
                  Account settings
                </Button>
                <Button variant="plain" type="button" onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="customer-main">
        {tab === "Home" && (
          <div className="customer-content">
            <section className="customer-welcome">
              <div>
                <span className="eyebrow">Your Styled by AMAC workspace</span>
                <h1 className="page-title">Welcome back, {userName}</h1>
                <p>Plan an event and keep in touch with our team.</p>
              </div>
            </section>
            <section className="customer-event-hero">
              <div className="customer-event-photo">
                <img src={photos.wedding} alt="Elegant event table setting" />
              </div>
              <div className="customer-event-summary">
                <div className="event-kicker">Your next celebration</div>
                <h2 className="customer-event-title">
                  Let’s bring your plans together
                </h2>
                <p>
                  Browse packages and services, share your event details, and
                  follow your request as our team reviews it.
                </p>
                <div className="customer-event-actions">
                  <Button onClick={() => go("Catalogs")}>
                    Explore catalogs
                  </Button>
                  <Button variant="secondary" onClick={() => go("My events")}>
                    My events
                  </Button>
                </div>
              </div>
            </section>
            <CustomerHomeNextStep key={profileId} />
          </div>
        )}
        {tab === "My events" && (
          <div className="customer-content">
            <BookingList
              requestedId={new URLSearchParams(search).get("bookingRequest")}
              onExplore={() => go("Catalogs")}
              onOpenChat={(reference: string) => {
                navigateWorkspace(
                  `/app/messages?request=${encodeURIComponent(reference)}`,
                );
              }}
            />
          </div>
        )}

        {tab === "Catalogs" && <CustomerCatalogPage search={search} />}

        {tab === "Profile" && (
          <div className="customer-content">
            <PageHeader
              title="Account settings"
              description="View your account and manage sign-in methods."
            />
            <Panel className="account-summary">
              <h2>Profile</h2>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{userName}</dd>
                </div>
                <div>
                  <dt>Email address</dt>
                  <dd>{userEmail}</dd>
                </div>
              </dl>
            </Panel>
            <SignInMethods />
          </div>
        )}

        {tab === "Messages" && (
          <div className="customer-messages-view">
            <MessagesWorkspace
              requestedQuotationId={
                requestedConversation === selectedConversationId
                  ? requestedQuotation
                  : null
              }
              title="Messages"
              viewerRole="customer"
              localAiReplyPending={
                !!messageThread &&
                hasLocalReplyPending(pendingReplies, messageThread.conversation)
              }
              localImageFiles={localFiles.current}
              onRetryProcessing={async (messageId) => {
                if (!selectedConversationId) return;

                const id = selectedConversationId;
                const aiVersion = messageThread?.conversation.aiVersion;
                const pollAtStart = successfulPolls.current;
                const { message } = await retryMyMessageProcessing(
                  id,
                  messageId,
                );
                replyRevision.current++;
                setMessageThread((current) =>
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
                                    [
                                      "completed",
                                      "failed",
                                      "suppressed",
                                    ].includes(item.processing?.status ?? ""),
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
              onBookingSubmitted={() => setThreadRevision((value) => value + 1)}
              onBookingClosed={() => {
                const url = new URL(window.location.href);

                if (url.searchParams.has("createRequest")) {
                  url.searchParams.delete("createRequest");
                  navigateWorkspace(
                    `${url.pathname}${url.search}${url.hash}`,
                    true,
                  );
                }
              }}
              conversations={messageConversations}
              activeConversation={
                messageThread?.conversation.id === selectedConversationId
                  ? messageThread.conversation
                  : null
              }
              activeId={selectedConversationId}
              onSelect={(id) => {
                if (requestedConversation) {
                  routeConversation.current = null;
                  navigateWorkspace(customerPaths.Messages, true);
                }

                void selectConversation(id);
              }}
              messages={
                messageThread?.conversation.id === selectedConversationId
                  ? addSentMessages(
                      messageThread,
                      Object.values(outbox)
                        .filter(
                          (item) =>
                            item.conversationId === selectedConversationId,
                        )
                        .map((item) => item.message),
                    ).messages
                  : Object.values(outbox)
                      .filter(
                        (item) =>
                          item.conversationId === selectedConversationId,
                      )
                      .map((item) => item.message)
              }
              conversationFeed={{
                hasMore: !!inbox.nextCursor,
                pending: inbox.loadingMore,
                error: inbox.moreError,
                onLoadMore: () => void inbox.loadMore(),
              }}
              hasOlder={
                messageThread?.conversation.id === selectedConversationId &&
                !!messageThread.nextCursor
              }
              loadingOlder={loadingOlder}
              olderError={olderError}
              onLoadOlder={() => void loadOlder()}
              historyNotice={historyNotice}
              loading={messagesLoading || threadLoading}
              error={messagesError || threadError}
              onRetry={() => {
                setThreadRevision((value) => value + 1);
                setReferenceAttempt((value) => value + 1);
                void inbox.refresh();
              }}
              sendDisabled={
                messageThread?.conversation.id !== selectedConversationId ||
                !!threadError
              }
              onSend={sendMessage}
              failedMessageIds={Object.values(outbox)
                .filter(
                  (item) =>
                    item.conversationId === selectedConversationId &&
                    item.failed &&
                    (item.message.reviewMessageId ||
                      !messageThread?.messages.some(
                        (message) => message.id === item.message.id,
                      )),
                )
                .map((item) => item.message.id)}
              failedMessageErrors={Object.fromEntries(
                Object.entries(outbox)
                  .filter(
                    ([, item]) =>
                      item.conversationId === selectedConversationId &&
                      item.error,
                  )
                  .map(([id, item]) => [id, item.error ?? ""]),
              )}
              onRetryMessage={(id) => {
                const item = outbox[id];
                const conversation = messageThread?.conversation;

                if (item && conversation?.id === item.conversationId)
                  void deliverMessage(conversation, item.message);
              }}
              onBack={() => {
                if (requestedConversation)
                  navigateWorkspace("/app/messages", true);

                setMobilePane("inbox");
              }}
              conversationOpen={conversationOpen}
              onNewChat={startNewChat}
              newChatBusy={newChatBusy}
              listEmpty={{
                title: "No conversation yet",
                body: "Start a conversation with the Styled by AMAC team.",
              }}
              threadEmpty={{
                title: "Say hello",
                body: "Ask the team about your event or a package.",
              }}
            />
          </div>
        )}
      </main>

      {bookingItem && (
        <BookingRequestDialog
          item={bookingItem}
          resume={bookingResume}
          onClose={() => {
            setBookingItem(null);
            const url = new URL(window.location.href);
            url.searchParams.delete("book");
            url.searchParams.delete("booking");
            navigateWorkspace(`${url.pathname}${url.search}${url.hash}`, true);
          }}
        />
      )}
    </div>
  );
}
