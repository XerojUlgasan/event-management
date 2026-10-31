import { useEffect, useRef, useState, type SubmitEvent } from "react"
import { Button, Icon } from "@event-management/ui"
import ReactMarkdown from "react-markdown"

import { getGuestReply } from "../../../lib/api"
import {
  guestChatContext,
  guestChatMessages,
  loadGuestChat,
  saveGuestChat,
  type GuestChat,
  type GuestChatEntry,
} from "../../../lib/guest-chat"

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
})
const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
})

const quickReplies = [
  "Recommend a package",
  "What is included?",
  "How does booking work?",
]

const bookingIntent =
  /\b(book|booking|reserve|reservation|quote|quotation|inquiry|staff|human|agent|manager|payment|confirm)\b/i

const unavailableMessage =
  "The assistant is unavailable right now. Please try again, or ask to speak with our team."

export function GuestChatPanel({
  onSignIn,
  onClose,
}: {
  onSignIn: () => void
  onClose: () => void
}) {
  const [chat, setChat] = useState<GuestChat>(() => loadGuestChat())
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [showSignIn, setShowSignIn] = useState(chat.needsStaff)
  const thread = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = thread.current
    if (element) element.scrollTop = element.scrollHeight
  }, [chat.messages.length, sending, showSignIn, error])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  async function requestReply(source: GuestChat) {
    setSending(true)
    setError("")
    try {
      const result = await getGuestReply(
        guestChatMessages(source),
        guestChatContext(source),
      )
      const needsAccount = /\bsign in|create an account|staff assistance|book(ing)? now|book this\b/i.test(result.reply)
      const withReply: GuestChat = {
        ...source,
        needsStaff: source.needsStaff || needsAccount,
        messages: [
          ...source.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            body: result.reply,
            createdAt: new Date().toISOString(),
          },
        ],
      }
      setChat(withReply)
      saveGuestChat(withReply)
      if (/\bsign in|create an account|staff assistance\b/i.test(result.reply)) {
        setShowSignIn(true)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : unavailableMessage)
    } finally {
      setSending(false)
    }
  }

  async function send(value: string) {
    const body = value.trim()
    if (!body || sending) return
    setDraft("")
    setError("")
    const userMessage: GuestChatEntry = {
      id: crypto.randomUUID(),
      role: "user",
      body,
      createdAt: new Date().toISOString(),
    }
    const next = { ...chat, messages: [...chat.messages, userMessage] }
    setChat(next)
    saveGuestChat(next)
    if (bookingIntent.test(body)) setShowSignIn(true)
    await requestReply(next)
  }

  function retry() {
    if (sending || chat.messages.at(-1)?.role !== "user") return
    void requestReply(chat)
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(draft)
  }

  function askForStaff() {
    if (sending) return
    setError("")
    setChat((current) => {
      const next = {
        ...current,
        needsStaff: true,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            role: "user" as const,
            body: "I’d like to speak with a staff member about my event.",
            createdAt: new Date().toISOString(),
          },
        ],
      }
      saveGuestChat(next)
      return next
    })
    setShowSignIn(true)
  }

  const lastMessage = chat.messages.at(-1)
  const dayText = lastMessage
    ? new Date(lastMessage.createdAt).toDateString() === new Date().toDateString()
      ? "Today"
      : dayFormatter.format(new Date(lastMessage.createdAt))
    : "Today"

  return (
    <div
      className="chat-panel"
      role="dialog"
      aria-labelledby="guest-chat-title"
    >
      <div className="chat-header">
        <div className="ai-icon">
          <Icon name="spark" />
        </div>
        <div className="chat-header-copy">
          <strong id="guest-chat-title">Clemora assistant</strong>
          <small>AI guidance · Staff confirm bookings</small>
        </div>
        <button
          type="button"
          className="chat-close"
          onClick={onClose}
          aria-label="Close chat"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="chat-body chat-messages" ref={thread} aria-live="polite">
        {chat.messages.length === 0 && !sending && !error && (
          <>
            <span className="chat-time">Today</span>
            <div className="message bot chat-welcome">
              Hi! I’m Clemora. Ask about packages, event planning, or talk to our
              team whenever you’re ready.
            </div>
          </>
        )}
        {chat.messages.length > 0 && <span className="chat-time">{dayText}</span>}
        {chat.messages.map((message) => (
          <div
            className={`message ${message.role === "user" ? "customer-message" : "bot"}`}
            key={message.id}
          >
            <ReactMarkdown>{message.body}</ReactMarkdown>
            <small className="message-meta">
              {timeFormatter.format(new Date(message.createdAt))}
            </small>
          </div>
        ))}
        {sending && (
          <div className="message bot chat-typing" role="status">
            Clemora is thinking…
          </div>
        )}
        {error && (
          <div className="chat-error" role="alert">
            <span>{error}</span>
            {chat.messages.at(-1)?.role === "user" && (
              <button type="button" onClick={retry} disabled={sending}>
                Try again
              </button>
            )}
          </div>
        )}
        {!sending && !error && chat.messages.length <= 1 && (
          <div className="quick-replies">
            {quickReplies.map((reply) => (
              <button type="button" key={reply} onClick={() => void send(reply)}>
                {reply}
              </button>
            ))}
          </div>
        )}
        {showSignIn && (
          <div className="chat-signin">
            <strong>Save this chat or talk to our team</strong>
            <p>
              Sign in or create an account to keep this conversation, request staff
              assistance, or continue with a booking inquiry.
            </p>
            <div className="chat-signin-actions">
              <Button onClick={onSignIn} icon="arrow">
                Sign in to continue
              </Button>
              <button
                type="button"
                className="chat-signin-dismiss"
                onClick={() => setShowSignIn(false)}
              >
                Not now
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="handover">
        <span>Need a person?</span>
        <button type="button" onClick={askForStaff} disabled={sending}>
          Talk to our team
        </button>
      </div>

      <form className="chat-input" onSubmit={submit}>
        <input
          aria-label="Ask about your event"
          placeholder="Ask about your event…"
          value={draft}
          maxLength={4000}
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" aria-label="Send" disabled={!draft.trim() || sending}>
          <Icon name="arrow" />
        </button>
      </form>
    </div>
  )
}
