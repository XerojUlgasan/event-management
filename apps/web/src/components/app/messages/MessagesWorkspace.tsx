import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages"
import { Fragment, useEffect, useRef, useState, type SubmitEvent } from "react"
import { Avatar, Badge, Button, Icon, Input } from "@event-management/ui"

import { getAdminBookingRequest, getMyBookingRequest, type BookingRequest } from "../../../lib/data/booking-requests"
import type { ChatConversation, ChatMessage } from "../../../lib/data/messages"
import { BookingDetails } from "../BookingList"
import { initialsFromName } from "../../../lib/utils/name"

const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
})
const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
})

function dayKey(value: string) {
  return new Date(value).toDateString()
}

function dayLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(value) === dayKey(today.toISOString())) return "Today"
  if (dayKey(value) === dayKey(yesterday.toISOString())) return "Yesterday"
  return dayFormatter.format(date)
}

function preview(conversation: ChatConversation) {
  const message = conversation.lastMessage
  if (!message) return "No messages yet"
  return message.body
}

export function MessagesWorkspace({
  title,
  viewerRole,
  conversations,
  hasMore = false,
  loadingMore = false,
  loadMoreError = "",
  onLoadMore,
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
}: {
  title: string
  viewerRole: "admin" | "customer"
  conversations: ChatConversation[]
  hasMore?: boolean
  loadingMore?: boolean
  loadMoreError?: string
  onLoadMore?: () => void
  activeId: string | null
  onSelect: (id: string) => void
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  onRetry?: () => void
  onSend: (body: string) => Promise<void>
  onBack: () => void
  conversationOpen: boolean
  listEmpty: { title: string; body: string }
  threadEmpty: { title: string; body: string }
  onNewChat?: () => void
  newChatBusy?: boolean
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [booking, setBooking] = useState<BookingRequest | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState("")
  const bookingLoad = useRef(0)
  const thread = useRef<HTMLDivElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const listEnd = useRef<HTMLDivElement>(null)
  const active = conversations.find((item) => item.id === activeId) ?? null
  const isTeam = viewerRole === "customer"
  const singleConversation = isTeam && conversations.length === 1
  const activeName = isTeam ? "Clemora team" : active?.customerName ?? "Messages"
  const activeDetail = isTeam
    ? active?.eventType || "Events and catering support"
    : [active?.eventType, active?.customerEmail].filter(Boolean).join(" · ") || "Choose a conversation to reply"
  const avatar = active && !isTeam ? initialsFromName(active.customerName) : "CT"
  const closedBookingForCustomer = isTeam && active?.status === "closed" && !!active.bookingRequestId
  const closedForCustomer = isTeam && active?.status === "closed" && !active.bookingRequestId

  useEffect(() => {
    setDraft("")
    setSendError("")
    setBooking(null)
    setBookingError("")
    setBookingLoading(false)
    bookingLoad.current++
  }, [activeId])

  useEffect(() => {
    const element = thread.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, activeId])

  useEffect(() => {
    if (!hasMore || loadingMore || loadMoreError || !onLoadMore || !listEnd.current || !sidebar.current || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root: sidebar.current, rootMargin: "0px 0px 150px 0px" },
    )
    observer.observe(listEnd.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMoreError, onLoadMore])

  async function openBooking() {
    if (!active?.bookingRequestId || bookingLoading) return
    const request = ++bookingLoad.current
    setBookingLoading(true)
    setBookingError("")
    try {
      const result = await (isTeam ? getMyBookingRequest(active.bookingRequestId) : getAdminBookingRequest(active.bookingRequestId))
      if (request === bookingLoad.current) setBooking(result.bookingRequest)
    } catch (cause) {
      if (request === bookingLoad.current) setBookingError(cause instanceof Error ? cause.message : "Unable to load booking details.")
    } finally {
      if (request === bookingLoad.current) setBookingLoading(false)
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending || readOnly || !activeId) return
    setSending(true)
    setSendError("")
    try {
      await onSend(body)
      setDraft("")
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : "Unable to send your message. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={`customer-messages panel ${conversationOpen ? "conversation-open" : ""} ${singleConversation ? "single-conversation" : ""}`}
    >
      <aside ref={sidebar}>
        <div className="messages-sidebar-head">
          <h1>{title}</h1>
          {isTeam && onNewChat && (
            <Button variant="plain" type="button" className="message-action" onClick={onNewChat} disabled={newChatBusy}>
              {newChatBusy ? "Starting…" : "New chat"}
            </Button>
          )}
        </div>
        {conversations.map((conversation) => {
          const name = isTeam ? "Clemora team" : conversation.customerName
          const conversationAvatar = isTeam ? "C" : initialsFromName(conversation.customerName)
          return (
            <Button
              variant="plain"
              type="button"
              key={conversation.id}
              className={conversation.id === activeId ? "active" : ""}
              aria-pressed={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar tone={isTeam ? "accent" : "default"} initials={conversationAvatar} />
              <span>
                <strong>{name}</strong>
                {conversation.eventType && <em className="conversation-booking">{conversation.eventType}</em>}
                <small>{preview(conversation)}</small>
              </span>
              <span className="conversation-badges">
                  <time dateTime={conversation.updatedAt} title={new Date(conversation.updatedAt).toLocaleString()}>
                    {dayKey(conversation.updatedAt) === dayKey(new Date().toISOString()) ? timeFormatter.format(new Date(conversation.updatedAt)) : `${dayLabel(conversation.updatedAt)} · ${timeFormatter.format(new Date(conversation.updatedAt))}`}
                  </time>
                  {conversation.unreadCount > 0 && (
                    <Badge tone="accent" variant="counter" aria-label={`${conversation.unreadCount} unread messages`}>
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </Badge>
                  )}
              </span>
            </Button>
          )
        })}
        {!loading && conversations.length === 0 && (
          <div className="messages-list-empty">
            <strong>{error ? "Could not load messages" : listEmpty.title}</strong>
            <p>{error || listEmpty.body}</p>
            {error && onRetry && (
              <Button variant="plain" type="button" className="messages-retry" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}
        {loadingMore && <p className="messages-list-status" role="status">Loading more conversations…</p>}
        {loadMoreError && <p className="messages-list-status" role="alert">{loadMoreError}</p>}
        {hasMore && onLoadMore && (
          <div className="messages-list-footer">
            <Button variant="plain" type="button" className="messages-load-more" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more conversations"}
            </Button>
          </div>
        )}
        {hasMore && <div ref={listEnd} aria-hidden="true" />}
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
              {active?.status === "closed" && <Badge tone="neutral">Closed</Badge>}
            </span>
            <small>{activeDetail}</small>
          </div>
          {active && (
            <div className="message-head-actions">
              {active.bookingRequestId && (
                <Button variant="plain" type="button" className="message-info" aria-label="View booking request details" title="View booking request details" onClick={() => void openBooking()} disabled={bookingLoading}>
                  <Icon name="info" size={19} />
                </Button>
              )}

            </div>
          )}
        </div>

        {bookingError && <div className="messages-error" role="alert"><span>{bookingError}</span><Button variant="plain" type="button" onClick={() => void openBooking()}>Try again</Button></div>}
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

        <div className="message-thread" ref={thread} aria-live="polite">
          {loading && messages.length === 0 && <p className="messages-empty">Loading messages…</p>}
          {!loading && !activeId && (
            <div className="messages-empty">
              <Icon name="users" size={22} />
              <strong>{conversations.length ? "Select a conversation" : listEmpty.title}</strong>
              <p>{conversations.length ? "Choose a customer to read and reply." : listEmpty.body}</p>
            </div>
          )}
          {!loading && activeId && messages.length === 0 && (
            <div className="messages-empty">
              <Icon name="users" size={22} />
              <strong>{threadEmpty.title}</strong>
              <p>{threadEmpty.body}</p>
            </div>
          )}
          {messages.map((message, index) => {
            const mine = message.senderRole === viewerRole
            const showDay = index === 0 || dayKey(message.createdAt) !== dayKey(messages[index - 1].createdAt)
            return (
              <Fragment key={message.id}>
                {showDay && <span className="chat-time">{dayLabel(message.createdAt)}</span>}
                <div className={`message ${mine ? "customer-message" : "bot"}`}>
                  {message.body}
                  <small className="message-meta">
                    {!mine && `${message.senderName} · `}
                    {timeFormatter.format(new Date(message.createdAt))}
                  </small>
                </div>
              </Fragment>
            )
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
            This booking conversation is closed. Start a new chat to message the team.
          </p>
        )}
        {closedForCustomer && (
          <p className="messages-closed-note">
            This conversation closed after inactivity. Send a message to reopen it; the
            history stays here.
          </p>
        )}

        {!readOnly && !closedBookingForCustomer && (
          <form className="thread-input input-group" onSubmit={submit}>
            <Input
              variant="plain"
              aria-label="Write a message"
              placeholder={
                closedForCustomer
                  ? "Send a message to reopen this conversation"
                  : "Write a message…"
              }
              value={draft}
              disabled={!activeId || sending}
              maxLength={MAX_MESSAGE_BODY_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              type="submit"
              icon="arrow"
              disabled={!draft.trim() || !activeId || sending}
            >
              {sending ? "Sending" : "Send"}
            </Button>
          </form>
        )}
      </section>
      {booking && <BookingDetails item={booking} readOnly={isTeam} customerCanEditTimes={isTeam} onClose={() => setBooking(null)} onSaved={setBooking} />}
    </div>
  )
}
