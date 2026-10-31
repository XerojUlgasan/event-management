import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react"
import {
  Brand,
  Button,
  Dialog,
  FormField,
  Icon,
  PageHeader,
  Panel,
  Toast,
} from "@event-management/ui"

import { photos } from "../data"
import { BookingList } from "../BookingList"
import { PackageCatalog } from "../PackageCatalog"
import { initialsFromName } from "../../../lib/name"
import { SignInMethods } from "../SignInMethods"
import { MessagesWorkspace } from "../messages/MessagesWorkspace"
import { mergeThread } from "../messages/thread"
import {
  getAssistantReply,
  createMyConversation,
  getMyConversations,
  getMyConversationById,
  requestStaffAssistance,
  sendMyMessage,
  updateConversationContext,
  type ChatMessage,
  type ChatConversation,
  type ChatThread,
  type PublicPackage,
} from "../../../lib/api"
import {
  claimPendingGuestChat,
  hasGuestHistory,
  loadGuestChat,
} from "../../../lib/guest-chat"

type CustomerTab =
  | "Home"
  | "My events"
  | "Packages"
  | "Messages"
  | "Profile"

function localDateTime(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CustomerDashboard({
  onPublic,
  userName,
  userEmail,
  onSignOut,
}: {
  onPublic: () => void
  userName: string
  userEmail: string
  onSignOut: () => void
}) {
  // A customer who signed in from the guest chat lands back in that thread.
  const [tab, setTab] = useState<CustomerTab>(() =>
    hasGuestHistory(loadGuestChat()) ? "Messages" : "Home",
  )
  const [messageOpen, setMessageOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [messageDraft, setMessageDraft] = useState("")
  const [dialogSending, setDialogSending] = useState(false)
  const [dialogError, setDialogError] = useState("")
  const [messageThread, setMessageThread] = useState<ChatThread | null>(null)
  const [messageConversations, setMessageConversations] = useState<ChatConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState("")
  const [assistantPending, setAssistantPending] = useState(false)
  const [assistantError, setAssistantError] = useState("")
  const [staffRequesting, setStaffRequesting] = useState(false)
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState("")
  const [newChatBusy, setNewChatBusy] = useState(false)
  const [toast, setToast] = useState("")

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  const refreshMessages = useCallback(async () => {
    try {
      // Restore a guest chat saved in this browser before loading the DB thread.
      const claimed = await claimPendingGuestChat()
      const { conversations } = await getMyConversations()
      setMessageConversations(conversations)
      if (claimed) {
        setSelectedConversationId(claimed.conversation.id)
        setMessageThread(claimed)
      } else {
        const targetId = selectedConversationId && conversations.some((item) => item.id === selectedConversationId)
          ? selectedConversationId
          : conversations[0]?.id ?? null
        setSelectedConversationId(targetId)
        if (targetId) {
          const thread = await getMyConversationById(targetId)
          setMessageThread((current) => mergeThread(current, thread))
        } else {
          setMessageThread(null)
        }
      }
      setMessagesError("")
    } catch (cause) {
      setMessagesError(cause instanceof Error ? cause.message : "Unable to load your messages.")
    } finally {
      setMessagesLoading(false)
    }
  }, [selectedConversationId])

  useEffect(() => {
    if (tab !== "Messages") return
    setMessagesLoading(true)
    void refreshMessages()
    const timer = window.setInterval(() => void refreshMessages(), 5000)
    return () => window.clearInterval(timer)
  }, [tab, refreshMessages])

  const appendMessage = (message: ChatMessage) => {
    setMessageThread((current) => {
      if (!current) return current
      if (current.messages.some((item) => item.id === message.id)) return current
      return {
        conversation: {
          ...current.conversation,
          lastMessage: message,
          updatedAt: message.createdAt,
        },
        messages: [...current.messages, message],
      }
    })
  }

  const fetchAssistantReply = async () => {
    setAssistantPending(true)
    setAssistantError("")
    try {
      const reply = await getAssistantReply()
      if (reply.message) appendMessage(reply.message)
      if (reply.status !== "active") {
        setMessageThread((current) =>
          current
            ? { ...current, conversation: { ...current.conversation, status: reply.status } }
            : current,
        )
      }
    } catch (cause) {
      setAssistantError(
        cause instanceof Error
          ? cause.message
          : "Clemora AI is unavailable right now. You can still ask for staff help.",
      )
    } finally {
      setAssistantPending(false)
    }
  }

  const sendMessage = async (body: string) => {
    const previousStatus = messageThread?.conversation.status ?? "active"
    const result = await sendMyMessage(body, messageThread?.conversation.id)
    appendMessage(result.message)
    // A new message reopens a closed general conversation; staff-handled
    // conversations stay with staff until they finish.
    if (previousStatus === "closed") {
      setMessageThread((current) =>
        current
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                status: "active",
                closedAt: null,
                packageId: null,
                packageName: null,
                eventType: null,
                eventStartsAt: null,
                eventEndsAt: null,
                guestCount: null,
              },
            }
          : current,
      )
    }
    if (previousStatus !== "active" && previousStatus !== "closed") return
    await fetchAssistantReply()
  }

  const askForStaff = async () => {
    if (staffRequesting) return
    setStaffRequesting(true)
    setAssistantError("")
    try {
      // Put the thread in the staff queue first so a send failure cannot leave
      // the assistant answering a customer who asked for a person.
      const thread = await requestStaffAssistance()
      setMessageThread(thread)
      const sent = await sendMyMessage(
        "I’d like to speak with a staff member about my event.",
        messageThread?.conversation.id,
      )
      appendMessage(sent.message)
      setAssistantPending(false)
      notify("Our team has been notified. You can keep adding details here.")
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Unable to request staff assistance.")
    } finally {
      setStaffRequesting(false)
    }
  }

  const askAboutPackage = async (item: PublicPackage) => {
    try {
      const thread = await updateConversationContext({
        packageId: item.id,
        eventType: item.eventTypes[0] ?? null,
      }, messageThread?.conversation.id)
      setMessageThread(thread)
      setConversationOpen(true)
      setTab("Messages")
      notify(`${item.name} is now linked to your conversation.`)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Unable to link this package.")
    }
  }

  const startNewChat = async () => {
    if (newChatBusy) return
    setNewChatBusy(true)
    try {
      const thread = await createMyConversation()
      setSelectedConversationId(thread.conversation.id)
      setMessageThread(thread)
      setMessageConversations((current) => [thread.conversation, ...current])
      setConversationOpen(true)
      notify("New chat started.")
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Unable to start a new chat.")
    } finally {
      setNewChatBusy(false)
    }
  }

  const selectConversation = async (id: string) => {
    setSelectedConversationId(id)
    setConversationOpen(true)
    setMessagesLoading(true)
    try {
      setMessageThread(await getMyConversationById(id))
      setMessagesError("")
    } catch (cause) {
      setMessagesError(cause instanceof Error ? cause.message : "Unable to load this conversation.")
    } finally {
      setMessagesLoading(false)
    }
  }

  const saveEventDetails = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const eventType = String(data.get("eventType") ?? "").trim()
    const guestCount = String(data.get("guestCount") ?? "").trim()
    const eventEndsAt = String(data.get("eventEndsAt") ?? "")
    setEventSaving(true)
    setEventError("")
    try {
      const thread = await updateConversationContext({
        eventType: eventType || null,
        guestCount: guestCount ? Number(guestCount) : null,
        eventEndsAt: eventEndsAt ? new Date(eventEndsAt).toISOString() : null,
      }, messageThread?.conversation.id)
      setMessageThread(thread)
      setEventDetailsOpen(false)
      notify("Event details saved to this conversation.")
    } catch (cause) {
      setEventError(cause instanceof Error ? cause.message : "Unable to save event details.")
    } finally {
      setEventSaving(false)
    }
  }

  const sendFromDialog = async () => {
    const body = messageDraft.trim()
    if (!body || dialogSending) return
    setDialogSending(true)
    setDialogError("")
    try {
      const thread = await requestStaffAssistance()
      setMessageThread(thread)
      const result = await sendMyMessage(body, messageThread?.conversation.id)
      appendMessage(result.message)
      setMessageDraft("")
      setMessageOpen(false)
      setConversationOpen(true)
      setTab("Messages")
      notify("Message sent. Our team is notified and will reply here.")
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : "Unable to send your message.")
    } finally {
      setDialogSending(false)
    }
  }

  useEffect(() => {
    if (!accountMenuOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false)
        accountTriggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", closeOnOutside)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [accountMenuOpen])
  const customerTabs: { label: CustomerTab; icon: string }[] = [
    { label: "Home", icon: "grid" },
    { label: "My events", icon: "calendar" },
    { label: "Packages", icon: "box" },
    { label: "Messages", icon: "users" },
  ]

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <button className="customer-brand-button" onClick={onPublic}>
          <Brand />
        </button>
        <nav className="customer-nav">
          {customerTabs.map((item) => (
            <button
              className={tab === item.label ? "active" : ""}
              key={item.label}
              onClick={() => setTab(item.label)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="customer-header-actions">
          <div className="customer-account-menu" ref={accountMenuRef}>
            <button
              type="button"
              ref={accountTriggerRef}
              className="customer-profile account-menu-trigger"
              aria-label={`Account menu for ${userName}`}
              aria-expanded={accountMenuOpen}
              aria-controls="customer-account-menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <span className="avatar">{initialsFromName(userName)}</span>
              <span><strong>{userName}</strong><small>Customer</small></span>
              <Icon name="chevron" size={14} />
            </button>
            {accountMenuOpen && (
              <div className="account-menu" id="customer-account-menu">
                <button type="button" onClick={() => { setTab("Profile"); setAccountMenuOpen(false) }}>
                  Account settings
                </button>
                <button type="button" onClick={onSignOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="customer-main">
        {tab === "Home" && (
          <div className="customer-content">
            <section className="customer-welcome"><div><span className="eyebrow">Your Clemora workspace</span><h1 className="page-title">Welcome back, {userName}</h1><p>Plan an event and keep in touch with our team.</p></div></section>
            <section className="customer-event-hero"><div className="customer-event-photo"><img src={photos.wedding} alt="Elegant event table setting" /></div><div className="customer-event-summary"><div className="event-kicker">Your next celebration</div><h2 className="customer-event-title">Let’s bring your plans together</h2><p>Explore our packages, share your event details, and follow your request as our team reviews it.</p><div className="customer-event-actions"><Button onClick={() => setTab("Packages")}>Explore packages</Button><Button variant="secondary" onClick={() => setTab("My events")}>My events</Button></div></div></section>
            <section className="customer-grid"><Panel title="Your requests" description="See the latest status of your event requests."><p>Preferred dates and final prices are reviewed by our team.</p><Button variant="secondary" onClick={() => setTab("My events")}>View my events</Button></Panel><Panel className="customer-manager-card" title="Talk with our team" description="Have a question about your plans?"><p>Send us a message and we’ll continue the conversation in your workspace.</p><Button variant="secondary" className="full-button" onClick={() => setMessageOpen(true)}>Send a message</Button></Panel></section>
          </div>
        )}
        {tab === "My events" && <div className="customer-content"><BookingList onExplore={() => setTab("Packages")} /></div>}

        {tab === "Packages" && (
          <div className="customer-content">
            <PageHeader
              title="Explore packages"
              description="Explore currently published packages."

            />
            <PackageCatalog onAsk={askAboutPackage} />
          </div>
        )}

        {tab === "Profile" && (
          <div className="customer-content">
            <div className="page-head">
              <div>
                <h1 className="page-title">Account settings</h1>
                <p>View your account and manage sign-in methods.</p>
              </div>
            </div>
            <Panel className="account-summary">
              <h2>Profile</h2>
              <dl>
                <div><dt>Name</dt><dd>{userName}</dd></div>
                <div><dt>Email address</dt><dd>{userEmail}</dd></div>
              </dl>
            </Panel>
            <SignInMethods />
          </div>
        )}

        {tab === "Messages" && (
          <div className="customer-messages-view">
            <MessagesWorkspace
              title="Messages"
              viewerRole="customer"
              conversations={messageConversations}
              activeId={messageThread?.conversation.id ?? null}
              onSelect={(id) => void selectConversation(id)}
              messages={messageThread?.messages ?? []}
              loading={messagesLoading}
              error={messagesError}
              onRetry={() => {
                setMessagesLoading(true)
                void refreshMessages()
              }}
              onSend={sendMessage}
              onBack={() => setConversationOpen(false)}
              conversationOpen={conversationOpen}
              onRequestStaff={askForStaff}
              onEditContext={() => {
                setEventError("")
                setEventDetailsOpen(true)
              }}
              onSelectPackage={askAboutPackage}
              onNewChat={startNewChat}
              newChatBusy={newChatBusy}
              assistantPending={assistantPending}
              assistantError={assistantError}
              onRetryAssistant={() => void fetchAssistantReply()}
              staffRequesting={staffRequesting}
              listEmpty={{
                title: "No conversation yet",
                body: "Ask Clemora about your event, or request staff assistance.",
              }}
              threadEmpty={{
                title: "Say hello",
                body: "Ask about your event, a package, or request staff assistance.",
              }}
            />
          </div>
        )}
      </main>

      {eventDetailsOpen && messageThread && (
        <Dialog
          onClose={() => setEventDetailsOpen(false)}
          className="compact-modal"
          eyebrow="Conversation context"
          title="Event details"
          intro="These details help Clemora answer with the right context. The event end also controls how long this conversation stays open."
        >
          <form onSubmit={saveEventDetails}>
            {messageThread.conversation.packageName && (
              <p className="event-context-package">
                Linked package <strong>{messageThread.conversation.packageName}</strong>
              </p>
            )}
            <div className="form-grid">
              <FormField label="Event type">
                <input
                  name="eventType"
                  maxLength={120}
                  defaultValue={messageThread.conversation.eventType ?? ""}
                  placeholder="Wedding, birthday, corporate…"
                />
              </FormField>
              <FormField label="Estimated guests">
                <input
                  name="guestCount"
                  type="number"
                  min="1"
                  defaultValue={messageThread.conversation.guestCount ?? ""}
                  placeholder="e.g. 80"
                />
              </FormField>
              <FormField className="full" label="Event end date and time">
                <input
                  name="eventEndsAt"
                  type="datetime-local"
                  defaultValue={localDateTime(messageThread.conversation.eventEndsAt)}
                />
              </FormField>
            </div>
            <p className="event-context-note">
              Event-related conversations remain available until 24 hours after the
              event ends. General conversations close after 24 hours without activity.
            </p>
            {eventError && (
              <p className="messages-send-error" role="alert">
                {eventError}
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => setEventDetailsOpen(false)}
                disabled={eventSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={eventSaving}>
                {eventSaving ? "Saving…" : "Save event details"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {messageOpen && (
        <Dialog
          onClose={() => setMessageOpen(false)}
          className="compact-modal"
          eyebrow="Message the Clemora team"
          title="How can we help?"
          intro="Send a message about your event, quotation, or booking. Our team will reply in Messages."
          actions={
            <>
              <Button variant="secondary" onClick={() => setMessageOpen(false)} disabled={dialogSending}>
                Cancel
              </Button>
              <Button onClick={sendFromDialog} disabled={!messageDraft.trim() || dialogSending}>
                {dialogSending ? "Sending…" : "Send message"}
              </Button>
            </>
          }
        >
            <label className="message-compose">
              <span>Message</span>
              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Write a message"
                maxLength={4000}
                autoFocus
              />
            </label>
            {dialogError && <p className="messages-send-error" role="alert">{dialogError}</p>}
        </Dialog>
      )}

      {toast && <Toast>{toast}</Toast>}
    </div>
  )
}

