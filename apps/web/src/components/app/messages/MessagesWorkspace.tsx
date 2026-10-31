import { Fragment, useEffect, useRef, useState, type SubmitEvent } from "react"
import { Button, Icon } from "@event-management/ui"
import ReactMarkdown from "react-markdown"

import type { ChatConversation, ChatMessage } from "../../../lib/api"
import { initialsFromName } from "../../../lib/name"

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
  return message.senderRole === "assistant" ? `AI: ${message.body}` : message.body
}

function conversationState(status: ChatConversation["status"]) {
  if (status === "waiting_staff") return "Waiting for staff"
  if (status === "staff") return "Staff handling · AI paused"
  if (status === "closed") return "Closed"
  return "AI responding"
}

function waitingLabel(status: ChatConversation["status"]) {
  if (status === "waiting_staff") return "Waiting"
  if (status === "staff") return "Staff"
  if (status === "closed") return "Closed"
  return null
}

export function MessagesWorkspace({
  title,
  viewerRole,
  conversations,
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
  onRequestStaff,
  onEditContext,
  onTakeover,
  onReturnToAi,
  assistantPending = false,
  assistantError = "",
  onRetryAssistant,
  staffRequesting = false,
  takeoverBusy = false,
  returningToAi = false,
  onNewChat,
  newChatBusy = false,
  readOnly = false,
}: {
  title: string
  viewerRole: "admin" | "customer"
  conversations: ChatConversation[]
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
  onRequestStaff?: () => void
  onEditContext?: () => void
  onTakeover?: () => void
  onReturnToAi?: () => void
  assistantPending?: boolean
  assistantError?: string
  onRetryAssistant?: () => void
  staffRequesting?: boolean
  takeoverBusy?: boolean
  returningToAi?: boolean
  onNewChat?: () => void
  newChatBusy?: boolean
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const thread = useRef<HTMLDivElement>(null)
  const active = conversations.find((item) => item.id === activeId) ?? null
  const isTeam = viewerRole === "customer"
  const singleConversation = isTeam && conversations.length === 1
  const activeName = isTeam ? "Clemora team" : active?.customerName ?? "Messages"
  const activeDetail = isTeam
    ? active?.bookingRequestReference
      ? `${active.bookingRequestReference} · ${active.eventType || "Event support"}`
      : active?.eventType ||
      "Events and catering support"
    : active?.bookingRequestReference
      ? `${active.bookingRequestReference} · ${active.customerEmail}`
      : active?.customerEmail ?? "Choose a conversation to reply"
  const avatar = active && !isTeam ? initialsFromName(active.customerName) : "CT"
  const activeState = active ? conversationState(active.status) : ""
  const closedForCustomer = isTeam && active?.status === "closed"
  const adminNeedsTakeover =
    !isTeam && (active?.status === "active" || active?.status === "waiting_staff")

  useEffect(() => {
    setDraft("")
    setSendError("")
  }, [activeId])

  useEffect(() => {
    const element = thread.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, activeId, assistantPending])

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending || assistantPending || readOnly || !activeId) return
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
      <aside>
        <div className="messages-sidebar-head">
          <h1>{title}</h1>
          {isTeam && onNewChat && (
            <button type="button" className="message-action" onClick={onNewChat} disabled={newChatBusy}>
              {newChatBusy ? "Starting…" : "New chat"}
            </button>
          )}
        </div>
        {conversations.map((conversation) => {
          const name = isTeam ? "Clemora team" : conversation.customerName
          const conversationAvatar = isTeam ? "C" : initialsFromName(conversation.customerName)
          return (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === activeId ? "active" : ""}
              aria-pressed={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            >
              <span className={`manager-avatar small ${isTeam ? "team-avatar" : ""}`}>
                {isTeam ? <Icon name="spark" size={15} /> : conversationAvatar}
              </span>
              <span>
                <strong>{name}</strong>
                {conversation.bookingRequestReference && (
                  <em className="conversation-booking">
                    {isTeam ? conversation.bookingRequestReference : conversation.packageName ?? conversation.bookingRequestReference}
                  </em>
                )}
                <small>{preview(conversation)}</small>
              </span>
              {(conversation.status === "active" || waitingLabel(conversation.status) || conversation.unreadCount > 0) && (
                <span className="conversation-badges">
                  {conversation.status === "active" && (
                    <em className="conversation-ai" aria-label="AI responses active">AI</em>
                  )}
                  {waitingLabel(conversation.status) && (
                    <em className={`conversation-waiting ${conversation.status}`}>
                      {waitingLabel(conversation.status)}
                    </em>
                  )}
                  {conversation.unreadCount > 0 && (
                    <span className="messages-unread" aria-label={`${conversation.unreadCount} unread messages`}>
                      {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
        {!loading && conversations.length === 0 && (
          <div className="messages-list-empty">
            <strong>{error ? "Could not load messages" : listEmpty.title}</strong>
            <p>{error || listEmpty.body}</p>
            {error && onRetry && (
              <button type="button" className="messages-retry" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        )}
      </aside>

      <section>
        <div className="message-thread-head">
          {!singleConversation && (
            <button
              type="button"
              className="message-back"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <Icon name="chevron" size={16} />
              <span>Back</span>
            </button>
          )}
          <span className={`manager-avatar small ${isTeam ? "team-avatar" : ""}`}>
            {isTeam ? <Icon name="spark" size={15} /> : avatar}
          </span>
          <div className="message-thread-title">
            <span className="message-thread-name">
              <strong>{activeName}</strong>
              {active && (
                <span className={`conversation-state ${active.status}`}>{activeState}</span>
              )}
            </span>
            {active?.bookingRequestReference && (
              <span className="message-booking-context">
                <Icon name="clipboard" size={13} />
                <span>{isTeam ? `Booking request ${active.bookingRequestReference}` : `Package: ${active.packageName ?? active.bookingRequestReference}`}</span>
                {active.eventType && <span>· {active.eventType}</span>}
              </span>
            )}
            <small>{activeDetail}</small>
          </div>
          {active && (
            <div className="message-head-actions">
              {isTeam && active.status === "active" && onRequestStaff && (
                <button
                  type="button"
                  className="message-action"
                  onClick={onRequestStaff}
                  disabled={staffRequesting}
                >
                  {staffRequesting ? "Requesting…" : "Talk to staff"}
                </button>
              )}
              {isTeam && active.status !== "closed" && onEditContext && (
                <button type="button" className="message-action" onClick={onEditContext}>
                  Event details
                </button>
              )}
              {!isTeam && active.status !== "closed" && (onTakeover || onReturnToAi) && (
                <label className="message-ai-switch">
                  <span>AI responses</span>
                  <input
                    type="checkbox"
                    checked={active.status === "active"}
                    onChange={active.status === "active" ? onTakeover : onReturnToAi}
                    disabled={takeoverBusy || returningToAi}
                  />
                  <span className="message-ai-switch-track" aria-hidden="true" />
                  <span className="sr-only">
                    {active.status === "active" ? "Turn AI responses off" : "Turn AI responses on"}
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="messages-error" role="alert">
            <span>{error}</span>
            {onRetry && (
              <button type="button" onClick={onRetry}>
                Try again
              </button>
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
            if (message.senderRole === "system") {
              return <p className="message-system-notice" key={message.id}>{message.body}</p>
            }
            const mine = message.senderRole === viewerRole
            const showDay = index === 0 || dayKey(message.createdAt) !== dayKey(messages[index - 1].createdAt)
            return (
              <Fragment key={message.id}>
                {showDay && <span className="chat-time">{dayLabel(message.createdAt)}</span>}
                <div className={`message ${mine ? "customer-message" : "bot"} ${message.senderRole === "assistant" ? "assistant-message" : ""}`}>
                  <ReactMarkdown>{message.body}</ReactMarkdown>
                  <small className="message-meta">
                    {!mine && `${message.senderName} · `}
                    {timeFormatter.format(new Date(message.createdAt))}
                  </small>
                </div>
              </Fragment>
            )
          })}
          {assistantPending && (
            <div className="message bot chat-typing" role="status">
              Clemora assistant is thinking…
            </div>
          )}
        </div>

        {assistantError && (
          <div className="messages-send-error assistant-error" role="alert">
            <span>{assistantError}</span>
            {onRetryAssistant && (
              <button
                type="button"
                onClick={onRetryAssistant}
                disabled={assistantPending}
              >
                Try again
              </button>
            )}
          </div>
        )}

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
        {closedForCustomer && (
          <p className="messages-closed-note">
            This conversation closed after inactivity. Send a message to reopen it; the
            history stays here.
          </p>
        )}

        {adminNeedsTakeover && onTakeover && (
          <div className="admin-takeover-prompt">
            <p>
              {active?.status === "waiting_staff"
                ? "The customer is waiting for staff assistance."
                : "AI is currently handling this conversation."}
            </p>
            <Button type="button" onClick={onTakeover} disabled={takeoverBusy}>
              {takeoverBusy ? "Taking over…" : "Take over to reply"}
            </Button>
          </div>
        )}

        {!readOnly && !adminNeedsTakeover && (
          <form className="thread-input" onSubmit={submit}>
            <input
              aria-label="Write a message"
              placeholder={
                closedForCustomer
                  ? "Send a message to reopen this conversation"
                  : "Write a message…"
              }
              value={draft}
              disabled={!activeId || sending}
              maxLength={4000}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              type="submit"
              icon="arrow"
              disabled={!draft.trim() || !activeId || sending || assistantPending}
            >
              {sending ? "Sending" : "Send"}
            </Button>
          </form>
        )}
      </section>
    </div>
  )
}
