import { Fragment, useEffect, useRef, useState, type SyntheticEvent } from "react"
import { Button, Icon } from "@event-management/ui"

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
  return message.body
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
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const thread = useRef<HTMLDivElement>(null)
  const active = conversations.find((item) => item.id === activeId) ?? null
  const activeName =
    viewerRole === "customer" ? "Clemora team" : active?.customerName ?? "Messages"
  const activeDetail =
    viewerRole === "customer" ? "Events and catering support" : active?.customerEmail ?? "Choose a conversation to reply"
  const activeInitials =
    viewerRole === "customer" ? "CT" : active ? initialsFromName(active.customerName) : "CT"

  useEffect(() => {
    setDraft("")
    setSendError("")
  }, [activeId])

  useEffect(() => {
    const element = thread.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, activeId])

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending || !activeId) return
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
    <div className={`customer-messages panel ${conversationOpen ? "conversation-open" : ""}`}>
      <aside>
        <h1>{title}</h1>
        {conversations.map((conversation) => {
          const name = viewerRole === "customer" ? "Clemora team" : conversation.customerName
          const avatar = viewerRole === "customer" ? "CT" : initialsFromName(conversation.customerName)
          return (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === activeId ? "active" : ""}
              aria-pressed={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            >
              <span className={`manager-avatar small ${viewerRole === "customer" ? "team-avatar" : ""}`}>{avatar}</span>
              <span>
                <strong>{name}</strong>
                <small>{preview(conversation)}</small>
              </span>
              {conversation.unreadCount > 0 && (
                <span className="messages-unread" aria-label={`${conversation.unreadCount} unread messages`}>
                  {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
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
          <button type="button" className="message-back" onClick={onBack}>
            Back to conversations
          </button>
          <span className={`manager-avatar small ${viewerRole === "customer" ? "team-avatar" : ""}`}>{activeInitials}</span>
          <span>
            <strong>{activeName}</strong>
            <small>{activeDetail}</small>
          </span>
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

        <form className="thread-input" onSubmit={submit}>
          <input
            aria-label="Write a message"
            placeholder="Write a message…"
            value={draft}
            disabled={!activeId || sending}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" icon="arrow" disabled={!draft.trim() || !activeId || sending}>
            {sending ? "Sending" : "Send"}
          </Button>
        </form>
      </section>
    </div>
  )
}
