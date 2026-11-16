import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  Icon,
  Textarea,
  useNotifications,
} from "@event-management/ui";

import type {
  ChatConversation,
  ChatMessage,
} from "../../lib/data/messages/conversations";
import { Quotations } from "../quotations/Quotations";
import {
  ConversationContext,
  type ConversationContextView,
} from "./ConversationContext";
import "../../styles/messages/messages.css";
import { initialsFromName } from "../../lib/utils/formatting/name";

const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});

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
  return dayFormatter.format(date);
}

function preview(conversation: ChatConversation) {
  const message = conversation.lastMessage;
  if (!message) return "No messages yet";
  return message.body;
}

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
  onBack,
  conversationOpen,
  listEmpty,
  threadEmpty,
  onNewChat,
  newChatBusy = false,
  readOnly = false,
  sendDisabled = false,
  hasOlder = false,
  loadingOlder = false,
  olderError = "",
  onLoadOlder,
  historyNotice = "",
}: {
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
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
  conversationOpen: boolean;
  listEmpty: { title: string; body: string };
  threadEmpty: { title: string; body: string };
  onNewChat?: () => void;
  newChatBusy?: boolean;
  readOnly?: boolean;
  sendDisabled?: boolean;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  olderError?: string;
  onLoadOlder?: () => void;
  historyNotice?: string;
}) {
  const { notify, notifyError } = useNotifications();
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const setDraft = (value: string) => {
    if (activeId) setDrafts((previous) => ({ ...previous, [activeId]: value }));
  };
  const [pendingSends, setPendingSends] = useState<Record<string, boolean>>({});
  const sending = !!activeId && !!pendingSends[activeId];
  const pendingSendIds = useRef(new Set<string>());
  const [sendError, setSendError] = useState("");
  const [context, setContext] = useState<{
    conversationId: string;
    view: ConversationContextView;
  } | null>(null);
  const generation = useRef(0);
  const thread = useRef<HTMLDivElement>(null);
  const inbox = useRef<HTMLElement>(null);
  const inboxBoundary = useRef<HTMLDivElement>(null);
  const historyBoundary = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const active =
    conversations.find((item) => item.id === activeId) ??
    activeConversation ??
    null;
  const isTeam = viewerRole === "customer";
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
      "Choose a conversation to reply";
  const avatar =
    active && !isTeam ? initialsFromName(active.customerName) : "CT";
  const closedBookingForCustomer =
    isTeam && active?.status === "closed" && !!active.bookingRequestId;
  const closedForCustomer =
    isTeam && active?.status === "closed" && !active.bookingRequestId;

  useEffect(() => {
    setSendError("");
    setContext(null);
    setQuotationId(null);
    generation.current++;
    return () => {
      generation.current++;
    };
  }, [activeId]);

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
  }, [messages, activeId]);

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

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (
      !body ||
      sending ||
      readOnly ||
      sendDisabled ||
      !activeId ||
      pendingSendIds.current.has(activeId)
    )
      return;
    const request = generation.current;
    const conversationId = activeId;
    const sentDraft = draft;
    pendingSendIds.current.add(conversationId);
    setPendingSends((previous) => ({ ...previous, [conversationId]: true }));
    setSendError("");
    try {
      await onSend(body);
      setDrafts((previous) =>
        previous[conversationId] === sentDraft
          ? { ...previous, [conversationId]: "" }
          : previous,
      );
      if (request !== generation.current) return;
      notify("Message sent.");
    } catch (cause) {
      if (request !== generation.current) return;
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
                {conversation.bookingRequestReference && (
                  <small className="conversation-reference">
                    {conversation.bookingRequestReference}
                    {conversation.eventStartsAt
                      ? ` · ${dayFormatter.format(new Date(conversation.eventStartsAt))}`
                      : ""}
                  </small>
                )}
                <small>{preview(conversation)}</small>
                {drafts[conversation.id] && (
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
                    ? timeFormatter.format(new Date(conversation.updatedAt))
                    : `${dayLabel(conversation.updatedAt)} · ${timeFormatter.format(new Date(conversation.updatedAt))}`}
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
              {active?.status === "closed" && (
                <Badge tone="neutral">Closed</Badge>
              )}
            </span>
            <small>{activeDetail}</small>
          </div>
          {active?.bookingRequestId && (
            <div
              className="message-head-actions"
              aria-label="Conversation information"
            >
              {(
                [
                  ["details", "info", "Details"],
                  ["package", "box", "Current package"],
                  ["quotation", "clipboard", "Quotation"],
                ] as const
              ).map(([view, icon, label]) => (
                <Button
                  variant="secondary"
                  key={view}
                  icon={icon}
                  aria-label={
                    view === "details"
                      ? "View event details"
                      : view === "package"
                        ? "View current package"
                        : "View latest sent quotation"
                  }
                  onClick={() =>
                    setContext({ conversationId: active.id, view })
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {active?.bookingRequestId && (
          <div className="message-event-context">
            <Icon name="calendar" size={16} />
            <strong>{active.eventType || "Event inquiry"}</strong>
            <span>{active.bookingRequestReference}</span>
            {active.eventStartsAt && (
              <span>
                Requested {dayFormatter.format(new Date(active.eventStartsAt))}
              </span>
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
                    message.body
                  )}
                  <small className="message-meta">
                    {!mine && `${message.senderName} · `}
                    {timeFormatter.format(new Date(message.createdAt))}
                  </small>
                </div>
              </Fragment>
            );
          })}
        </div>

        {sendError && (
          <p className="messages-send-error" role="alert">
            {sendError}
          </p>
        )}

        {readOnly && (
          <p className="messages-closed-note">
            This conversation is closed. Its history is kept for reference.
          </p>
        )}
        {closedBookingForCustomer && (
          <p className="messages-closed-note">
            This booking conversation is closed. Start a new chat to message the
            team.
          </p>
        )}
        {closedForCustomer && (
          <p className="messages-closed-note">
            This conversation is closed. Send a message to reopen it; the
            history stays here.
          </p>
        )}

        {!readOnly && !closedBookingForCustomer && (
          <form className="thread-input message-composer" onSubmit={submit}>
            <label htmlFor="conversation-message">
              {isTeam ? "Message the Styled by AMAC team" : "Reply to customer"}
            </label>
            <Textarea
              variant="plain"
              rows={2}
              id="conversation-message"
              aria-label="Write a message"
              placeholder={
                closedForCustomer
                  ? "Send a message to reopen this conversation"
                  : "Write a message…"
              }
              value={draft}
              disabled={!activeId || sending || sendDisabled}
              maxLength={MAX_MESSAGE_BODY_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="message-composer-actions">
              <small>Ctrl/⌘ + Enter to send</small>
              <Button
                type="submit"
                icon="arrow"
                pending={sending}
                disabled={!draft.trim() || !activeId || sending || sendDisabled}
              >
                {sending
                  ? viewerRole === "customer"
                    ? "Waiting for AI…"
                    : "Sending…"
                  : "Send message"}
              </Button>
            </div>
          </form>
        )}
      </section>
      {quotationId && (
        <Dialog title="Quotation" onClose={() => setQuotationId(null)}>
          <Quotations
            key={quotationId}
            quotationId={quotationId}
            bookingId={active?.bookingRequestId ?? undefined}
            admin={!isTeam}
          />
        </Dialog>
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
