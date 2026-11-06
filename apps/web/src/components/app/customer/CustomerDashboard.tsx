import { MAX_MESSAGE_BODY_LENGTH } from "@event-management/contracts/limits/messages"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Avatar,
  Brand,
  Button,
  Dialog,
  Icon,
  type IconName,
  PageHeader,
  Panel,
  Textarea,
  FormField,
  Toast,
  type ToastTone,
} from "@event-management/ui"

import { photos } from "../data"
import { BookingList } from "./BookingList"
import { PackageCatalog } from "../PackageCatalog"
import { initialsFromName } from "../../../lib/name"
import { SignInMethods } from "../SignInMethods"
import { MessagesWorkspace } from "../messages/MessagesWorkspace"
import { mergeThread } from "../messages/thread"
import {
  createMyConversation,
  getMyConversations,
  getMyConversation,
  getMyConversationById,
  sendMyMessage,
  type ChatMessage,
  type ChatConversation,
  type ChatThread,
} from "../../../lib/api"

type CustomerTab =
  | "Home"
  | "My events"
  | "Packages"
  | "Messages"
  | "Profile"

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
  const [tab, setTab] = useState<CustomerTab>("Home")
  const [messageOpen, setMessageOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [messageDraft, setMessageDraft] = useState("")
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const [dialogSending, setDialogSending] = useState(false)
  const [dialogError, setDialogError] = useState("")
  const [messageThread, setMessageThread] = useState<ChatThread | null>(null)
  const [messageConversations, setMessageConversations] = useState<ChatConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [pendingBookingReference, setPendingBookingReference] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState("")
  const [newChatBusy, setNewChatBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const notify = (message: string, tone: ToastTone = "success") => {
    if (!mountedRef.current) return
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ message, tone })
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null
      setToast(null)
    }, 2600)
  }

  const refreshMessages = useCallback(async () => {
    try {
      const { conversations } = await getMyConversations()
      setMessageConversations(conversations)
      const targetId = pendingBookingReference
        ? conversations.find((item) => item.bookingRequestReference === pendingBookingReference)?.id ?? null
        : selectedConversationId && conversations.some((item) => item.id === selectedConversationId)
        ? selectedConversationId
        : conversations[0]?.id ?? null
      setSelectedConversationId(targetId)
      if (targetId) {
        const thread = await getMyConversationById(targetId)
        setMessageThread((current) => mergeThread(current, thread))
      } else {
        setMessageThread(null)
      }
      setMessagesError("")
    } catch (cause) {
      setMessagesError(cause instanceof Error ? cause.message : "Unable to load your messages.")
    } finally {
      setMessagesLoading(false)
    }
  }, [pendingBookingReference, selectedConversationId])

  useEffect(() => {
    if (tab !== "Messages") return
    setMessagesLoading(true)
    void refreshMessages()
    const timer = window.setInterval(() => void refreshMessages(), 5000)
    return () => window.clearInterval(timer)
  }, [tab, refreshMessages])

  const showSentInList = (conversation: ChatConversation, message: ChatMessage) => {
    setMessageConversations((current) => {
      const source = current.find((item) => item.id === conversation.id) ?? conversation
      return [
        { ...source, status: "active", lastMessage: message, updatedAt: message.createdAt },
        ...current.filter((item) => item.id !== conversation.id),
      ]
    })
  }

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

  const sendMessage = async (body: string) => {
    const previousStatus = messageThread?.conversation.status ?? "active"
    const result = await sendMyMessage(body, messageThread?.conversation.id)
    appendMessage(result.message)
    if (messageThread) showSentInList(messageThread.conversation, result.message)
    // A new message reopens a closed general conversation.
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
      notify(cause instanceof Error ? cause.message : "Unable to start a new chat.", "danger")
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

  const sendFromDialog = async () => {
    const body = messageDraft.trim()
    if (!body || dialogSending) return
    setDialogSending(true)
    setDialogError("")
    try {
      const thread = messageThread ?? await getMyConversation()
      const result = await sendMyMessage(body, thread.conversation.id)
      setSelectedConversationId(thread.conversation.id)
      setMessageThread({
        conversation: { ...thread.conversation, status: "active", lastMessage: result.message, updatedAt: result.message.createdAt },
        messages: [...thread.messages, result.message],
      })
      showSentInList(thread.conversation, result.message)
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
  const customerTabs: { label: CustomerTab; icon: IconName }[] = [
    { label: "Home", icon: "grid" },
    { label: "My events", icon: "calendar" },
    { label: "Packages", icon: "box" },
    { label: "Messages", icon: "users" },
  ]

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <Button variant="plain" className="customer-brand-button" onClick={onPublic}>
          <Brand />
        </Button>
        <nav className="customer-nav">
          {customerTabs.map((item) => (
            <Button
              variant="plain"
              className={tab === item.label ? "active" : ""}
              key={item.label}
              onClick={() => setTab(item.label)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="customer-header-actions">
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
              <span><strong>{userName}</strong><small>Customer</small></span>
              <Icon name="chevron" size={14} />
            </Button>
            {accountMenuOpen && (
              <div className="account-menu" id="customer-account-menu">
                <Button variant="plain" type="button" onClick={() => { setTab("Profile"); setAccountMenuOpen(false) }}>
                  Account settings
                </Button>
                <Button variant="plain" type="button" onClick={onSignOut}>Sign out</Button>
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
        {tab === "My events" && <div className="customer-content"><BookingList onExplore={() => setTab("Packages")} onOpenChat={(reference: string) => { setPendingBookingReference(reference); setTab("Messages") }} /></div>}

        {tab === "Packages" && (
          <div className="customer-content">
            <PageHeader
              title="Explore packages"
              description="Explore currently published packages."

            />
            <PackageCatalog />
          </div>
        )}

        {tab === "Profile" && (
          <div className="customer-content">
            <PageHeader
              title="Account settings"
              description="View your account and manage sign-in methods."
            />
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
              onNewChat={startNewChat}
              newChatBusy={newChatBusy}
              listEmpty={{
                title: "No conversation yet",
                body: "Start a conversation with the Clemora team.",
              }}
              threadEmpty={{
                title: "Say hello",
                body: "Ask the team about your event or a package.",
              }}
            />
          </div>
        )}
      </main>

      {messageOpen && (
        <Dialog
          onClose={() => setMessageOpen(false)}
          initialFocus={messageInputRef}
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
            <FormField className="message-compose" label="Message">
              <Textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Write a message"
                maxLength={MAX_MESSAGE_BODY_LENGTH}
                ref={messageInputRef}
              />
            </FormField>
            {dialogError && <p className="messages-send-error" role="alert">{dialogError}</p>}
        </Dialog>
      )}

      {toast && <Toast tone={toast.tone}>{toast.message}</Toast>}
    </div>
  )
}

