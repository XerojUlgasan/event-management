import {
  reviewForComposition,
  reviewForSend,
} from "../../lib/services/messages/booking-review";
import { latestSuggestedReplyMessage } from "../../lib/services/messages/suggested-replies";
import { navigateWorkspace } from "../../lib/navigation/workspace-navigation";
import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AssistantTyping,
  Avatar,
  Badge,
  Button,
  Dialog,
  Icon,
  InfoDisclosure,
  Markdown,
  Textarea,
  useNotifications,
} from "@event-management/ui";

import type {
  ChatConversation,
  ChatMessage,
} from "../../lib/data/messages/conversations";
import { bookingDate } from "../booking-requests/BookingRequestDisplay";
import { ConversationBooking } from "../booking-requests/ConversationBooking";
import { Quotations } from "../quotations/Quotations";
import {
  ConversationContext,
  type ConversationContextView,
} from "./ConversationContext";
import "../../styles/messages/messages.css";
import { MessageAttachments, MessageImages } from "./MessageImages";
import { CatalogRecommendations } from "./CatalogRecommendations";
import { SuggestedReplies } from "./SuggestedReplies";
import { MessageProcessing } from "./MessageProcessing";
import { useAgentProfile } from "./use-agent-profile";
import { initialsFromName } from "../../lib/utils/formatting/name";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";
import {
  enPhDayFormatter,
  enPhTimeFormatter,
} from "../../lib/utils/formatting/dates";

function dayKey(value: string) {
  return new Date(value).toDateString();
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(value) === dayKey(today.toISOString())) return "Today";

  if (dayKey(value) === dayKey(yesterday.toISOString())) return "Yesterday";

  return enPhDayFormatter.format(date);
}

function preview(conversation: ChatConversation) {
  const message = conversation.lastMessage;

  if (!message) return "No messages yet";

  return (
    message.body ||
    (message.images?.length || message.pendingFiles?.length ? "Image" : "")
  );
}

const handoffReason = {
  customer_requested: "Customer requested a person",
  needs_admin_review: "Requires an admin decision",
  cannot_answer: "AI could not answer with available information",
} as const;

export function MessagesWorkspace({
  title,
  viewerRole,
  conversations,
  activeConversation,
  conversationFeed,
  activeId,
  onSelect,
  messages,
  loading,
  error,
  onRetry,
  onSend,
  failedMessageIds = [],
  failedMessageErrors = {},
  onRetryMessage,
  onRetryProcessing,
  onToggleAi,
  pendingAiToggle = false,
  onBack,
  conversationOpen,
  listEmpty,
  threadEmpty,
  onNewChat,
  newChatBusy = false,
  sendDisabled = false,
  hasOlder = false,
  loadingOlder = false,
  olderError = "",
  onLoadOlder,
  historyNotice = "",
  localAiReplyPending = false,
  localImageFiles,
  requestedQuotationId,
  onBookingSubmitted,
  onBookingClosed,
}: {
  requestedQuotationId?: string | null;
  onBookingSubmitted?: () => void;
  onBookingClosed?: () => void;
  title: string;
  viewerRole: "admin" | "customer";
  conversations: ChatConversation[];
  activeConversation?: ChatConversation | null;
  conversationFeed?: {
    hasMore: boolean;
    pending: boolean;
    error: string;
    onLoadMore: () => void;
  };
  activeId: string | null;
  onSelect: (id: string) => void;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onSend: (
    body: string,
    files: File[],
    requestId: string,
    reviewMessageId?: string,
  ) => Promise<void>;
  failedMessageIds?: string[];
  failedMessageErrors?: Record<string, string>;
  onRetryMessage?: (id: string) => void;
  onRetryProcessing?: (id: string) => Promise<void>;
  onToggleAi?: (
    conversationId: string,
    aiEnabled: boolean,
    expectedAiVersion: number,
  ) => void;
  pendingAiToggle?: boolean;
  onBack: () => void;
  conversationOpen: boolean;
  listEmpty: { title: string; body: string };
  threadEmpty: { title: string; body: string };
  onNewChat?: () => void;
  newChatBusy?: boolean;
  sendDisabled?: boolean;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  olderError?: string;
  onLoadOlder?: () => void;
  historyNotice?: string;
  localAiReplyPending?: boolean;
  localImageFiles?: ReadonlyMap<string, File[]>;
}) {
  const { notify, notifyError } = useNotifications();
  const composerShortcutId = useId();
  const agentProfile = useAgentProfile();
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const visibleQuotationId = requestedQuotationId ?? quotationId;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const reviewPins = useRef<Record<string, string | null | undefined>>({});
  const respondedToSuggestion = useRef<Record<string, string>>({});

  const setDraft = (value: string) => {
    if (!activeId) return;

    if (viewerRole === "customer")
      reviewPins.current[activeId] = reviewForComposition(
        draft,
        value,
        reviewPins.current[activeId],
        messages,
      );

    setSendError("");
    setDrafts((previous) => ({ ...previous, [activeId]: value }));
  };

  const [fileDrafts, setFileDrafts] = useState<Record<string, File[]>>({});
  const files = activeId ? (fileDrafts[activeId] ?? []) : [];
  const sendKeys = useRef<
    Record<string, { body: string; files: File[]; requestId: string }>
  >({});
  const [pendingSends, setPendingSends] = useState<Record<string, boolean>>({});
  const sending = !!activeId && !!pendingSends[activeId];
  const pendingSendIds = useRef(new Set<string>());
  const [sendError, setSendError] = useState("");
  const [context, setContext] = useState<{
    conversationId: string;
    view: ConversationContextView;
  } | null>(null);
  const generation = useRequestGeneration();
  const thread = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const inbox = useRef<HTMLElement>(null);
  const inboxBoundary = useRef<HTMLDivElement>(null);
  const historyBoundary = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const active =
    (activeConversation?.id === activeId ? activeConversation : null) ??
    conversations.find((item) => item.id === activeId) ??
    null;

  const aiReplyPending =
    !!activeId &&
    !!active?.aiEnabled &&
    (localAiReplyPending || !!active.aiReplyPending);
  const isTeam = viewerRole === "customer";
  const composerDisabled = !activeId || (!isTeam && sending) || sendDisabled;
  const suggestedMessage =
    isTeam && active?.aiEnabled && !composerDisabled && !aiReplyPending
      ? latestSuggestedReplyMessage(messages)
      : undefined;
  const singleConversation =
    isTeam &&
    conversations.length === 1 &&
    conversations[0]?.id === activeId &&
    !conversationFeed?.hasMore;
  const activeName = isTeam
    ? "Styled by AMAC team"
    : (active?.customerName ?? "Messages");
  const activeDetail = isTeam
    ? active?.eventType || "Events and catering support"
    : [active?.eventType, active?.customerEmail].filter(Boolean).join(" · ") ||
      (active
        ? active.customerId
          ? "General inquiry"
          : "Anonymous inquiry"
        : "Choose a conversation to reply");
  const avatar =
    active && !isTeam ? initialsFromName(active.customerName) : "CT";
  const [bookingConversationId, setBookingConversationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    setSendError("");
    setContext(null);
    setQuotationId(null);
    generation.bump();

    return () => {
      generation.bump();
    };
  }, [activeId, generation]);

  const olderScroll = useRef<{
    id?: string;
    offset: number;
    height: number;
    top: number;
  } | null>(null);
  const previousFirst = useRef<string | undefined>(undefined);
  const previousActive = useRef<string | null>(null);
  useLayoutEffect(() => {
    const element = thread.current;
    const changedConversation = previousActive.current !== activeId;

    if (changedConversation) olderScroll.current = null;

    const first = messages[0]?.id;

    if (element && olderScroll.current && first !== previousFirst.current) {
      const anchor = olderScroll.current;

      const row = [
        ...element.querySelectorAll<HTMLElement>("[data-message-id]"),
      ].find((item) => item.dataset.messageId === anchor.id);

      element.scrollTop = row
        ? element.scrollTop +
          row.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          anchor.offset
        : anchor.top + element.scrollHeight - anchor.height;
      olderScroll.current = null;
    } else if (
      element &&
      (changedConversation ||
        !previousFirst.current ||
        nearBottom.current ||
        first !== previousFirst.current)
    ) {
      element.scrollTop = element.scrollHeight;
    }

    if (element)
      nearBottom.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 80;

    previousFirst.current = first;
    previousActive.current = activeId;
  }, [messages, activeId, aiReplyPending]);

  useEffect(() => {
    if (!loadingOlder) olderScroll.current = null;
  }, [loadingOlder]);

  const requestOlder = useCallback(() => {
    if (!onLoadOlder || loadingOlder || !hasOlder) return;

    const element = thread.current;

    if (element) {
      const top = element.getBoundingClientRect().top;

      const row = [
        ...element.querySelectorAll<HTMLElement>("[data-message-id]"),
      ].find((item) => item.getBoundingClientRect().bottom > top);

      olderScroll.current = {
        id: row?.dataset.messageId,
        offset: row ? row.getBoundingClientRect().top - top : 0,
        height: element.scrollHeight,
        top: element.scrollTop,
      };
    }

    onLoadOlder();
  }, [onLoadOlder, loadingOlder, hasOlder]);

  useEffect(() => {
    const root = inbox.current;
    const boundary = inboxBoundary.current;

    if (
      !root ||
      !boundary ||
      !conversationFeed?.hasMore ||
      conversationFeed.pending ||
      conversationFeed.error ||
      loading
    )
      return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && root.clientHeight > 0)
          conversationFeed.onLoadMore();
      },
      { root, rootMargin: "120px 0px" },
    );

    observer.observe(boundary);

    return () => observer.disconnect();
  }, [conversationFeed, loading, conversationOpen]);

  useEffect(() => {
    const root = thread.current;
    const boundary = historyBoundary.current;

    if (
      !root ||
      !boundary ||
      !hasOlder ||
      loadingOlder ||
      olderError ||
      loading ||
      !messages.length
    )
      return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && root.clientHeight > 0) requestOlder();
      },
      { root, rootMargin: "120px 0px" },
    );

    observer.observe(boundary);

    return () => observer.disconnect();
  }, [
    requestOlder,
    hasOlder,
    loadingOlder,
    olderError,
    loading,
    messages.length,
    activeId,
    conversationOpen,
  ]);

  async function send(suggestion?: { messageId: string; body: string }) {
    const body = suggestion?.body ?? draft.trim();
    const sentFiles = suggestion ? [] : files;

    if (
      (!body && !sentFiles.length) ||
      composerDisabled ||
      !activeId ||
      (!isTeam && pendingSendIds.current.has(activeId))
    )
      return;

    if (
      suggestion &&
      (suggestion.messageId !== suggestedMessage?.id ||
        respondedToSuggestion.current[activeId] === suggestion.messageId ||
        !suggestedMessage.replies.includes(body))
    )
      return;

    const request = generation.current();
    const conversationId = activeId;
    const sentDraft = draft;
    const previous = sendKeys.current[conversationId];
    const reviewMessageId = isTeam
      ? reviewForSend(
          suggestion?.messageId ?? reviewPins.current[conversationId],
          sentFiles.length > 0,
        )
      : undefined;

    const requestId =
      !suggestion &&
      previous &&
      previous.body === body &&
      previous.files.length === sentFiles.length &&
      previous.files.every((file, i) => file === sentFiles[i])
        ? previous.requestId
        : crypto.randomUUID();

    if (!suggestion)
      sendKeys.current[conversationId] = { body, files, requestId };

    if (isTeam) {
      if (suggestedMessage)
        respondedToSuggestion.current[conversationId] = suggestedMessage.id;

      if (!suggestion) {
        setDrafts((previous) => ({ ...previous, [conversationId]: "" }));
        delete reviewPins.current[conversationId];
        setFileDrafts((previous) => ({ ...previous, [conversationId]: [] }));
        delete sendKeys.current[conversationId];
      }

      void onSend(body, sentFiles, requestId, reviewMessageId);
      composer.current?.focus();

      return;
    }

    pendingSendIds.current.add(conversationId);
    setPendingSends((previous) => ({ ...previous, [conversationId]: true }));
    setSendError("");

    try {
      await onSend(body, sentFiles, requestId);
      delete sendKeys.current[conversationId];
      setFileDrafts((previous) =>
        previous[conversationId] === sentFiles
          ? { ...previous, [conversationId]: [] }
          : previous,
      );
      setDrafts((previous) =>
        previous[conversationId] === sentDraft
          ? { ...previous, [conversationId]: "" }
          : previous,
      );

      if (!generation.isCurrent(request)) return;

      notify("Message sent.");
    } catch (cause) {
      if (!generation.isCurrent(request)) return;

      setSendError(
        notifyError(cause, "Unable to send your message. Please try again."),
      );
    } finally {
      pendingSendIds.current.delete(conversationId);
      setPendingSends((previous) => ({ ...previous, [conversationId]: false }));
    }
  }

  return (
    <div
      className={`customer-messages messages-workspace panel ${conversationOpen ? "conversation-open" : ""} ${singleConversation ? "single-conversation" : ""}`}
    >
      <aside ref={inbox} tabIndex={0} aria-label="Conversations">
        <div className="messages-sidebar-head">
          <h1>{title}</h1>
          {isTeam && onNewChat && (
            <Button
              variant="plain"
              type="button"
              className="message-action"
              onClick={onNewChat}
              disabled={newChatBusy}
            >
              {newChatBusy ? "Starting…" : "New chat"}
            </Button>
          )}
        </div>
        {conversations.map((conversation) => {
          const name = isTeam
            ? conversation.eventType || "General questions"
            : conversation.customerName;
          const conversationAvatar = isTeam
            ? "C"
            : initialsFromName(conversation.customerName);

          return (
            <Button
              variant="plain"
              type="button"
              key={conversation.id}
              className={conversation.id === activeId ? "active" : ""}
              aria-pressed={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar
                tone={isTeam ? "accent" : "default"}
                initials={conversationAvatar}
              />
              <span>
                <strong>{name}</strong>
                {!isTeam && conversation.eventType && (
                  <em className="conversation-booking">
                    {conversation.eventType}
                  </em>
                )}
                {conversation.bookingRequestId && (
                  <small className="conversation-reference">
                    {conversation.eventPreferredDate
                      ? `Requested ${bookingDate(conversation.eventPreferredDate)}`
                      : "Date to be arranged"}
                  </small>
                )}
                <small>{preview(conversation)}</small>
                {(drafts[conversation.id] ||
                  (fileDrafts[conversation.id]?.length ?? 0) > 0) && (
                  <small className="conversation-draft">Draft</small>
                )}
              </span>
              <span className="conversation-badges">
                <time
                  dateTime={conversation.updatedAt}
                  title={new Date(conversation.updatedAt).toLocaleString()}
                >
                  {dayKey(conversation.updatedAt) ===
                  dayKey(new Date().toISOString())
                    ? enPhTimeFormatter.format(new Date(conversation.updatedAt))
                    : `${dayLabel(conversation.updatedAt)} · ${enPhTimeFormatter.format(new Date(conversation.updatedAt))}`}
                </time>
                {conversation.unreadCount > 0 && (
                  <Badge
                    tone="accent"
                    variant="counter"
                    aria-label={`${conversation.unreadCount} unread messages`}
                  >
                    {conversation.unreadCount > 9
                      ? "9+"
                      : conversation.unreadCount}
                  </Badge>
                )}
                {viewerRole === "admin" && conversation.aiHandoff?.pending && (
                  <Badge tone="warning">Needs attention</Badge>
                )}
              </span>
            </Button>
          );
        })}
        {!loading && conversations.length === 0 && (
          <div className="messages-list-empty">
            <strong>
              {error ? "Could not load messages" : listEmpty.title}
            </strong>
            <p>{error || listEmpty.body}</p>
            {error && onRetry && (
              <Button
                variant="plain"
                type="button"
                className="messages-retry"
                onClick={onRetry}
              >
                Try again
              </Button>
            )}
          </div>
        )}
        {conversationFeed && (
          <div className="messages-list-footer" ref={inboxBoundary}>
            {conversationFeed.error ? (
              <div role="alert">
                <p>{conversationFeed.error}</p>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={conversationFeed.onLoadMore}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <p role="status">
                {conversationFeed.pending || (loading && !conversations.length)
                  ? "Loading conversations…"
                  : conversationFeed.hasMore
                    ? "Scroll for more conversations"
                    : conversations.length
                      ? "All conversations loaded"
                      : ""}
              </p>
            )}
          </div>
        )}
      </aside>

      <section>
        <div className="message-thread-head">
          {!singleConversation && (
            <Button
              variant="plain"
              type="button"
              className="message-back"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <Icon name="chevron" size={16} />
              <span>Back</span>
            </Button>
          )}
          <Avatar tone={isTeam ? "accent" : "default"} initials={avatar} />
          <div className="message-thread-title">
            <span className="message-thread-name">
              <strong>{activeName}</strong>
            </span>
            <small>{activeDetail}</small>
          </div>
          {viewerRole === "customer" && active && !active.bookingRequestId && (
            <Button
              variant="secondary"
              className="message-booking-action"
              aria-label="Create booking request"
              aria-haspopup="dialog"
              onClick={() => setBookingConversationId(active.id)}
            >
              <Icon name="plus" size={20} />
              <span>Create booking request</span>
            </Button>
          )}
          {active && (active.bookingRequestId || onToggleAi) && (
            <div
              className="message-head-actions"
              role="group"
              aria-label="Conversation controls"
            >
              {viewerRole === "admin" && onToggleAi && (
                <>
                  <Button
                    variant="plain"
                    className="message-ai-switch"
                    role="switch"
                    aria-label="AI replies"
                    aria-checked={active.aiEnabled}
                    aria-busy={pendingAiToggle}
                    title={
                      active.aiEnabled ? "AI replies on" : "AI replies off"
                    }
                    disabled={pendingAiToggle}
                    onClick={() =>
                      onToggleAi(active.id, !active.aiEnabled, active.aiVersion)
                    }
                  >
                    <span className="message-ai-switch-track">
                      <span className="message-ai-switch-thumb">
                        <Icon
                          name={pendingAiToggle ? "spinner" : "spark"}
                          size={14}
                        />
                      </span>
                    </span>
                  </Button>
                  {active.aiHandoff && (
                    <div
                      className="message-handoff"
                      data-pending={active.aiHandoff.pending}
                    >
                      <InfoDisclosure
                        key={active.id}
                        icon={active.aiHandoff.pending ? "alert" : "users"}
                        label={
                          active.aiHandoff.pending
                            ? "Needs attention: View AI handoff details"
                            : "View AI handoff details"
                        }
                        hint={handoffReason[active.aiHandoff.reason]}
                      >
                        <div className="message-handoff-details">
                          <strong>
                            {handoffReason[active.aiHandoff.reason]}
                          </strong>
                          <div className="message-handoff-summary-label">
                            AI summary
                          </div>
                          <p>{active.aiHandoff.summary}</p>
                          <Badge
                            tone={
                              active.aiHandoff.pending ? "warning" : "neutral"
                            }
                          >
                            {active.aiHandoff.pending
                              ? "Needs attention"
                              : "Taken over"}
                          </Badge>
                        </div>
                      </InfoDisclosure>
                    </div>
                  )}
                </>
              )}
              {active.bookingRequestId &&
                (
                  [
                    ["details", "info", "View event details"],
                    ["package", "box", "View current package"],
                    ["quotation", "clipboard", "View latest sent quotation"],
                  ] as const
                ).map(([view, icon, label]) => (
                  <Button
                    variant="secondary"
                    size="icon"
                    key={view}
                    icon={icon}
                    aria-label={label}
                    title={label}
                    onClick={() =>
                      setContext({ conversationId: active.id, view })
                    }
                  />
                ))}
            </div>
          )}
        </div>
        {active?.bookingRequestId && (
          <div className="message-event-context">
            <Icon name="calendar" size={16} />
            <strong>{active.eventType || "Event inquiry"}</strong>
            {active.eventPreferredDate && (
              <span>Requested {bookingDate(active.eventPreferredDate)}</span>
            )}
          </div>
        )}

        {error && (
          <div className="messages-error" role="alert">
            <span>{error}</span>
            {onRetry && (
              <Button variant="plain" type="button" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}

        <div
          className="message-thread"
          ref={thread}
          tabIndex={0}
          aria-label="Message history"
          aria-live="polite"
          onScroll={() => {
            const element = thread.current;

            if (element)
              nearBottom.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                80;
          }}
        >
          {loading && messages.length === 0 && (
            <p className="messages-empty">Loading messages…</p>
          )}
          {!loading && !activeId && (
            <div className="messages-empty">
              <Icon name="users" size={22} />
              <strong>
                {conversations.length
                  ? "Select a conversation"
                  : listEmpty.title}
              </strong>
              <p>
                {conversations.length
                  ? "Choose a customer to read and reply."
                  : listEmpty.body}
              </p>
            </div>
          )}
          {!loading && activeId && messages.length === 0 && (
            <div className="messages-empty">
              <Icon name="users" size={22} />
              <strong>{threadEmpty.title}</strong>
              <p>{threadEmpty.body}</p>
            </div>
          )}
          {historyNotice && <p role="status">{historyNotice}</p>}
          {hasOlder && onLoadOlder && (
            <div className="messages-history-boundary" ref={historyBoundary}>
              {olderError ? (
                <div role="alert">
                  <p>{olderError}</p>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={requestOlder}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <p role="status">
                  {loadingOlder
                    ? "Loading earlier messages…"
                    : "Scroll up for earlier messages"}
                </p>
              )}
            </div>
          )}
          {!hasOlder && messages.length > 0 && (
            <p className="messages-history-start">Beginning of conversation</p>
          )}
          {messages.map((message, index) => {
            const mine = message.senderRole === viewerRole;
            const showDay =
              index === 0 ||
              dayKey(message.createdAt) !==
                dayKey(messages[index - 1].createdAt);

            return (
              <Fragment key={message.id}>
                {showDay && (
                  <span className="chat-time">
                    {dayLabel(message.createdAt)}
                  </span>
                )}
                <div
                  className={`message ${mine ? "customer-message" : "bot"}`}
                  data-message-id={message.id}
                >
                  {message.quotationId ? (
                    <div className="message-quotation">
                      <span className="message-quotation-icon">
                        <Icon name="clipboard" size={22} />
                      </span>
                      <div>
                        <strong>Quotation</strong>
                        <p>{message.body}</p>
                        <Button
                          variant="secondary"
                          onClick={() => setQuotationId(message.quotationId)}
                        >
                          View quotation
                          <Icon name="arrow" size={16} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Markdown source={message.body} variant="message" />
                  )}
                  <MessageImages
                    message={{
                      ...message,
                      pendingFiles:
                        message.pendingFiles ??
                        localImageFiles?.get(message.id),
                    }}
                  />
                  <MessageProcessing
                    message={message}
                    onRetry={
                      viewerRole === "admin" ||
                      message.senderRole === "customer"
                        ? onRetryProcessing
                        : undefined
                    }
                  />
                  {failedMessageIds.includes(message.id) && (
                    <div className="message-delivery-error" role="alert">
                      {failedMessageErrors[message.id] ||
                        "Delivery could not be confirmed."}{" "}
                      {onRetryMessage && (
                        <Button
                          variant="link"
                          onClick={() => onRetryMessage(message.id)}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  )}
                  <small className="message-meta">
                    {!mine &&
                      `${message.senderRole === "assistant" ? agentProfile.senderLabel : message.senderName} · `}
                    {enPhTimeFormatter.format(new Date(message.createdAt))}
                  </small>
                </div>
                {message.senderRole === "assistant" && (
                  <CatalogRecommendations
                    recommendations={message.catalogRecommendations}
                  />
                )}
                {suggestedMessage?.id === message.id &&
                  activeId &&
                  respondedToSuggestion.current[activeId] !== message.id && (
                    <SuggestedReplies
                      replies={suggestedMessage.replies}
                      onSelect={(body) =>
                        void send({ messageId: message.id, body })
                      }
                    />
                  )}
              </Fragment>
            );
          })}
          {aiReplyPending && (
            <div className="message bot message-typing">
              <AssistantTyping />
            </div>
          )}
        </div>

        {sendError && (
          <p className="messages-send-error" role="alert">
            {sendError}
          </p>
        )}

        <form
          className="message-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <span id={composerShortcutId} className="sr-only">
            Enter to send. Shift plus Enter for a new line.
          </span>
          <MessageAttachments
            files={files}
            onChange={(next) =>
              activeId &&
              setFileDrafts((previous) => ({ ...previous, [activeId]: next }))
            }
            disabled={composerDisabled}
          >
            <Textarea
              variant="plain"
              ref={composer}
              rows={1}
              aria-label="Write a message"
              aria-describedby={composerShortcutId}
              placeholder="Message…"
              value={draft}
              disabled={composerDisabled}
              maxLength={MAX_MESSAGE_BODY_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              icon="arrow"
              pending={!isTeam && sending}
              aria-label="Send message"
              title="Send message"
              disabled={composerDisabled || (!draft.trim() && !files.length)}
            />
          </MessageAttachments>
        </form>
      </section>
      {visibleQuotationId && (
        <Dialog
          title="Quotation"
          onClose={() => {
            setQuotationId(null);

            if (requestedQuotationId) {
              const url = new URL(window.location.href);
              url.searchParams.delete("quotation");
              navigateWorkspace(
                `${url.pathname}${url.search}${url.hash}`,
                true,
              );
            }
          }}
        >
          <Quotations
            key={visibleQuotationId}
            quotationId={visibleQuotationId}
            bookingId={active?.bookingRequestId ?? undefined}
            admin={!isTeam}
          />
        </Dialog>
      )}
      {bookingConversationId && bookingConversationId === active?.id && (
        <ConversationBooking
          conversationId={bookingConversationId}
          onClose={() => {
            setBookingConversationId(null);
            onBookingClosed?.();
          }}
          onSubmitted={() => onBookingSubmitted?.()}
        />
      )}
      {context?.conversationId === activeId && active?.bookingRequestId && (
        <ConversationContext
          key={`${active.id}:${context.view}`}
          bookingId={active.bookingRequestId}
          admin={!isTeam}
          view={context.view}
          onClose={() => setContext(null)}
        />
      )}
    </div>
  );
}
