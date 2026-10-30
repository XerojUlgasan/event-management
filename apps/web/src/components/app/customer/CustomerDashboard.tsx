import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react"
import {
  Badge,
  Brand,
  Button,
  Dialog,
  FormField,
  Icon,
  PageHeader,
  Panel,
  Tabs,
  Toast,
} from "@event-management/ui"

import { photos } from "../data"
import { PackageCatalog } from "../PackageCatalog"
import { initialsFromName } from "../../../lib/name"
import { SignInMethods } from "../SignInMethods"
import { MessagesWorkspace } from "../messages/MessagesWorkspace"
import { mergeThread } from "../messages/thread"
import {
  getAssistantReply,
  getMyConversation,
  requestStaffAssistance,
  sendMyMessage,
  updateConversationContext,
  type ChatMessage,
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

type CustomerBookingStatus =
  | "Confirmed"
  | "Awaiting payment"
  | "Under review"
  | "Cancelled"

type QuoteLine = {
  label: string
  detail: string
  amount: number
}

type CustomerQuote = {
  id: string
  revision: number
  preparedBy: string
  preparedOn: string
  validUntil: string
  approvedOn?: string
  reservationFee: number
  lines: QuoteLine[]
}

type CustomerBooking = {
  id: number
  event: string
  packageName: string
  eventType: string
  date: string
  venue: string
  guests: number
  status: CustomerBookingStatus
  quote?: CustomerQuote
}

function localDateTime(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)

const quoteTotal = (quote: CustomerQuote) =>
  quote.lines.reduce((total, line) => total + line.amount, 0)

const statusPriority: Record<CustomerBookingStatus, number> = {
  "Awaiting payment": 0,
  "Under review": 1,
  Confirmed: 2,
  Cancelled: 3,
}

const weddingQuote: CustomerQuote = {
  id: "Q-2048",
  revision: 2,
  preparedBy: "Amina Santos",
  preparedOn: "June 2, 2025",
  validUntil: "June 18, 2025",
  approvedOn: "June 8, 2025",
  reservationFee: 1500,
  lines: [
    {
      label: "The Signature Table",
      detail: "Sample package total",
      amount: 12960,
    },
    {
      label: "Classic linen & table styling",
      detail: "18 tables",
      amount: 1080,
    },
    {
      label: "Wireless microphone set",
      detail: "2 sets",
      amount: 400,
    },
    {
      label: "Dietary menu additions",
      detail: "12 guests",
      amount: 420,
    },
  ],
}

const anniversaryQuote: CustomerQuote = {
  id: "Q-5924",
  revision: 1,
  preparedBy: "Amina Santos",
  preparedOn: "June 14, 2025",
  validUntil: "June 30, 2025",
  reservationFee: 750,
  lines: [
    {
      label: "Executive Dinner",
      detail: "Sample package total",
      amount: 4640,
    },
    {
      label: "Beverage pairing",
      detail: "80 guests",
      amount: 640,
    },
    {
      label: "Floral centerpieces",
      detail: "8 tables",
      amount: 520,
    },
  ],
}

function QuoteBreakdown({
  booking,
  quote,
}: {
  booking: CustomerBooking
  quote: CustomerQuote
}) {
  const total = quoteTotal(quote)
  const paymentDue = booking.status === "Awaiting payment"

  return (
    <>
      <div className="payment-event-card">
        <div>
          <span className="eyebrow">Event</span>
          <strong>{booking.event}</strong>
          <small>
            {booking.date} · {booking.guests} guests · {booking.venue}
          </small>
        </div>
        <Badge tone={paymentDue ? "warning" : "success"}>
          {paymentDue ? "Payment due" : "Approved"}
        </Badge>
      </div>

      <div className="payment-quote">
        <div className="payment-quote-head">
          <span>
            <strong>Quotation {quote.id}</strong>
            <small>
              Revision {quote.revision} · Prepared by {quote.preparedBy}
            </small>
          </span>
          <span>
            {paymentDue
              ? `Valid until ${quote.validUntil}`
              : `Approved ${quote.approvedOn ?? quote.preparedOn}`}
          </span>
        </div>
        <div className="payment-lines">
          {quote.lines.map((line) => (
            <div key={line.label}>
              <span>
                <strong>{line.label}</strong>
                <small>{line.detail}</small>
              </span>
              <strong>{money(line.amount)}</strong>
            </div>
          ))}
        </div>
        <div className="payment-total">
          <span>Quotation total</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="payment-fee">
          <span>
            <strong>
              {paymentDue ? "Reservation fee due" : "Reservation fee paid"}
            </strong>
            <small>
              {paymentDue
                ? `Due by ${quote.validUntil}`
                : "Credited toward your quotation total"}
            </small>
          </span>
          <strong>{money(quote.reservationFee)}</strong>
        </div>
        <div className="payment-balance">
          <span>Balance after reservation fee</span>
          <strong>{money(total - quote.reservationFee)}</strong>
        </div>
      </div>
    </>
  )
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
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState("")
  const [assistantPending, setAssistantPending] = useState(false)
  const [assistantError, setAssistantError] = useState("")
  const [staffRequesting, setStaffRequesting] = useState(false)
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState("")

  const refreshMessages = useCallback(async () => {
    try {
      // Restore a guest chat saved in this browser before loading the DB thread.
      const claimed = await claimPendingGuestChat()
      const thread = claimed ?? (await getMyConversation())
      setMessageThread((current) => mergeThread(current, thread))
      setMessagesError("")
    } catch (cause) {
      setMessagesError(cause instanceof Error ? cause.message : "Unable to load your messages.")
    } finally {
      setMessagesLoading(false)
    }
  }, [])

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
    const result = await sendMyMessage(body)
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
      const sent = await sendMyMessage("I’d like to speak with a staff member about my event.")
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
      })
      setMessageThread(thread)
      setConversationOpen(true)
      setTab("Messages")
      notify(`${item.name} is now linked to your conversation.`)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Unable to link this package.")
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
      })
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
      const result = await sendMyMessage(body)
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
  const [requestPackage, setRequestPackage] = useState<string | null>(null)
  const [editingRequest, setEditingRequest] = useState<number | null>(null)
  const [quoteBookingId, setQuoteBookingId] = useState<number | null>(null)
  const [paymentBookingId, setPaymentBookingId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card")
  const [paymentReference, setPaymentReference] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [customerBookings, setCustomerBookings] = useState<CustomerBooking[]>([
    {
      id: 2048,
      event: "Mendoza–Reyes Wedding",
      packageName: "The Signature Table",
      eventType: "Wedding",
      date: "Jun 22, 2025",
      venue: "The Glass Garden",
      guests: 180,
      status: "Confirmed",
      quote: weddingQuote,
    },
    {
      id: 5821,
      event: "Mendoza Family Brunch",
      packageName: "Garden Social",
      eventType: "Family gathering",
      date: "Aug 10, 2025",
      venue: "Mendoza Residence",
      guests: 60,
      status: "Under review",
    },
    {
      id: 5924,
      event: "Mendoza Anniversary Dinner",
      packageName: "Executive Dinner",
      eventType: "Anniversary",
      date: "Sep 20, 2025",
      venue: "The Glass Garden",
      guests: 80,
      status: "Awaiting payment",
      quote: anniversaryQuote,
    },
  ])


  const paymentDueBooking = customerBookings.find(
    (booking) => booking.status === "Awaiting payment" && booking.quote,
  )
  const paymentBooking = customerBookings.find(
    (booking) => booking.id === paymentBookingId,
  )
  const activePayment = paymentBooking?.quote
    ? { booking: paymentBooking, quote: paymentBooking.quote }
    : null
  const quoteBooking = customerBookings.find(
    (booking) => booking.id === quoteBookingId,
  )
  const activeQuote = quoteBooking?.quote
    ? { booking: quoteBooking, quote: quoteBooking.quote }
    : null

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  const openPayment = (bookingId: number) => {
    setPaymentBookingId(bookingId)
    setPaymentMethod("card")
    setPaymentReference(null)
  }

  const closePayment = () => {
    setPaymentBookingId(null)
    setPaymentReference(null)
  }

  const payReservationFee = () => {
    if (!paymentBooking) return
    setCustomerBookings((items) =>
      items.map((item) =>
        item.id === paymentBooking.id ? { ...item, status: "Confirmed" } : item,
      ),
    )
    setPaymentReference(`RF-${paymentBooking.id}`)
  }

  const statusTone = (status: CustomerBookingStatus) =>
    status === "Confirmed"
      ? "success"
      : status === "Cancelled"
        ? "danger"
        : status === "Awaiting payment"
          ? "info"
          : "warning"

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
        {tab !== "Packages" && tab !== "Messages" && tab !== "Profile" && <p className="demo-note" role="note">Demo preview · Requests, quotes, and payments are not submitted.</p>}
        {tab === "Home" && (
          <div className="customer-content">
            <section className="customer-welcome">
              <div>
                <span className="eyebrow">Monday, June 16</span>
                <div className="page-title">Welcome back, Elena</div>
                <p>
                  Your celebration is coming together beautifully. Here’s the
                  latest.
                </p>
              </div>
              <Button icon="spark">Ask Clemora</Button>
            </section>

            <section className="customer-event-hero">
              <div className="customer-event-photo">
                <img src={photos.wedding} alt="Elegant wedding table setting" />
                <Badge tone="light">Confirmed</Badge>
              </div>
              <div className="customer-event-summary">
                <div className="event-kicker">Your upcoming event</div>
                <div className="customer-event-title">
                  Mendoza–Reyes Wedding
                </div>
                <div className="customer-event-meta">
                  <span>
                    <Icon name="calendar" /> Sunday, June 22, 2025
                  </span>
                  <span>
                    <Icon name="users" /> 180 guests
                  </span>
                  <span>
                    <Icon name="grid" /> The Glass Garden
                  </span>
                </div>
                <div className="days-countdown">
                  <strong>6</strong>
                  <span>days until your event</span>
                </div>
                <div className="customer-event-actions">
                  <Button onClick={() => setTab("My events")}>
                    View event details
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setMessageOpen(true)}
                  >
                    Message your manager
                  </Button>
                </div>
              </div>
            </section>

            <section className="customer-grid">
              <Panel
                className="customer-progress-card"
                title="Booking progress"
                description="Everything is on track"
                action={<Badge tone="success">Confirmed</Badge>}
              >
                <div className="horizontal-steps">
                  {[
                    "Request",
                    "Quotation",
                    "Confirmed",
                    "Preparation",
                    "Event day",
                  ].map((step, index) => (
                    <div
                      className={
                        index < 2
                          ? "complete"
                          : index === 2
                            ? "current"
                            : ""
                      }
                      key={step}
                    >
                      <span>
                        {index < 2 ? (
                          <Icon name="check" size={13} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <small>{step}</small>
                    </div>
                  ))}
                </div>
                <div className="progress-update">
                  <span className="attention-icon info">
                    <Icon name="clipboard" />
                  </span>
                  <span>
                    <strong>Final guest count due June 18</strong>
                    <small>
                      Confirm your final attendance and dietary requirements.
                    </small>
                  </span>
                  <button>Review</button>
                </div>
              </Panel>

              <Panel className="customer-manager-card">
                <div className="panel-title">Your catering manager</div>
                <div className="manager-profile">
                  <span className="manager-avatar">AS</span>
                  <span>
                    <strong>Amina Santos</strong>
                    <small>Usually replies within 2 hours</small>
                  </span>
                  <Badge tone="success">Online</Badge>
                </div>
                <p>
                  “Hi Elena, everything is on track. I’ve sent your tasting
                  appointment details—let me know if you need anything.”
                </p>
                <Button
                  variant="secondary"
                  className="full-button"
                  onClick={() => setMessageOpen(true)}
                >
                  Continue conversation
                </Button>
              </Panel>
            </section>

            {paymentDueBooking?.quote && (
              <section className="payment-due-banner">
                <span className="attention-icon warning">
                  <Icon name="clipboard" />
                </span>
                <span>
                  <strong>
                    Reservation fee due for {paymentDueBooking.event}
                  </strong>
                  <small>
                    Quotation {paymentDueBooking.quote.id} is ready. Pay{" "}
                    {money(paymentDueBooking.quote.reservationFee)} by{" "}
                    {paymentDueBooking.quote.validUntil} to secure your date.
                  </small>
                </span>
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => setQuoteBookingId(paymentDueBooking.id)}
                  >
                    View quotation
                  </Button>
                  <Button
                    icon="check"
                    onClick={() => openPayment(paymentDueBooking.id)}
                  >
                    Review & pay
                  </Button>
                </div>
              </section>
            )}

            <section className="customer-grid lower">
              <Panel
                title="Next steps"
                description="Two items need your attention"
              >
                <div className="customer-action-list">
                  <button>
                    <span className="action-date">
                      <strong>18</strong>
                      <small>JUN</small>
                    </span>
                    <span>
                      <strong>Confirm final guest count</strong>
                      <small>
                        Currently 180 guests · Dietary details incomplete
                      </small>
                    </span>
                    <Badge tone="warning">Due in 2 days</Badge>
                    <Icon name="chevron" />
                  </button>
                  <button>
                    <span className="action-date soft">
                      <strong>19</strong>
                      <small>JUN</small>
                    </span>
                    <span>
                      <strong>Menu tasting appointment</strong>
                      <small>Clemora Studio · 3:30 PM</small>
                    </span>
                    <Badge tone="info">Scheduled</Badge>
                    <Icon name="chevron" />
                  </button>
                </div>
              </Panel>
              <Panel
                className="quote-summary-card"
                title="Approved quotation"
                action={<Badge tone="success">Approved</Badge>}
              >
                <div className="quote-package">
                  <span>The Signature Table</span>
                  <strong>₱14,860.00</strong>
                </div>
                <div className="quote-lines">
                  <span>
                    Package · 180 guests <strong>₱12,960</strong>
                  </span>
                  <span>
                    Styling & equipment <strong>₱1,480</strong>
                  </span>
                  <span>
                    Dietary menu additions <strong>₱420</strong>
                  </span>
                </div>
                <button
                  className="inline-link"
                  onClick={() => setQuoteBookingId(2048)}
                >
                  View quotation details <Icon name="arrow" size={14} />
                </button>
              </Panel>
            </section>
          </div>
        )}

        {tab === "My events" && (
          <div className="customer-content">
            <PageHeader
              title="My events"
              description="Track upcoming and completed catering bookings."
              actions={
                <Button icon="calendar" onClick={() => setTab("Packages")}>
                  Plan another event
                </Button>
              }
            />
            <Tabs
              active="upcoming"
              items={[
                { value: "upcoming", label: "Upcoming", count: 1 },
                { value: "requests", label: "Requests", count: 2 },
                { value: "completed", label: "Completed", count: 2 },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            {[...customerBookings]
              .sort(
                (first, second) =>
                  statusPriority[first.status] - statusPriority[second.status],
              )
              .map((booking) => (
              <div
                className={`customer-event-record panel ${booking.status === "Cancelled" ? "muted-record" : ""}`}
                key={booking.id}
              >
                <div className="event-record-top">
                  <div>
                    <Badge tone={statusTone(booking.status)}>
                      {booking.status}
                    </Badge>
                    <div className="customer-event-title">{booking.event}</div>
                    <p>Booking CLM-{booking.id} · {booking.packageName}</p>
                  </div>
                  <div className="record-date">
                    <strong>{booking.date.split(" ")[1]?.replace(",", "") || "—"}</strong>
                    <span>{booking.date.split(" ")[0]?.toUpperCase()} 2025</span>
                  </div>
                </div>
                <div className="event-record-details">
                  <span><small>Event type</small><strong>{booking.eventType}</strong></span>
                  <span><small>Venue</small><strong>{booking.venue}</strong></span>
                  <span><small>Guests</small><strong>{booking.guests}</strong></span>
                  <span><small>Status</small><strong>{booking.status}</strong></span>
                </div>
                <div className="event-record-footer">
                  <span>
                    <Icon name={booking.status === "Confirmed" ? "check" : "clipboard"} />
                    {booking.status === "Confirmed"
                      ? "Your event is confirmed and in preparation."
                      : booking.status === "Cancelled"
                        ? "This request was cancelled."
                        : booking.status === "Awaiting payment"
                          ? "Your quotation is ready. Pay the reservation fee to confirm your date."
                          : "The owner is reviewing your booking request."}
                  </span>
                  {booking.status === "Awaiting payment" && booking.quote && (
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => setQuoteBookingId(booking.id)}
                      >
                        View quotation
                      </Button>
                      <Button
                        icon="check"
                        onClick={() => openPayment(booking.id)}
                      >
                        Review & pay
                      </Button>
                    </div>
                  )}
                  {booking.status === "Confirmed" && booking.quote && (
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => setQuoteBookingId(booking.id)}
                      >
                        View quotation
                      </Button>
                    </div>
                  )}
                  {booking.status === "Under review" && (
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingRequest(booking.id)
                          setRequestPackage(booking.packageName)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setCustomerBookings((items) =>
                            items.map((item) =>
                              item.id === booking.id
                                ? { ...item, status: "Cancelled" }
                                : item,
                            ),
                          )
                        }
                      >
                        Cancel request
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
              conversations={messageThread ? [messageThread.conversation] : []}
              activeId={messageThread?.conversation.id ?? null}
              onSelect={() => setConversationOpen(true)}
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

      {activeQuote && (
        <Dialog
          onClose={() => setQuoteBookingId(null)}
          className="payment-modal"
          eyebrow={`Quotation ${activeQuote.quote.id} · Revision ${activeQuote.quote.revision}`}
          title={activeQuote.booking.event}
          intro={`Prepared by ${activeQuote.quote.preparedBy} for ${activeQuote.booking.date}.`}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setQuoteBookingId(null)}
              >
                Close
              </Button>
              {activeQuote.booking.status === "Awaiting payment" ? (
                <Button
                  icon="check"
                  onClick={() => {
                    setQuoteBookingId(null)
                    openPayment(activeQuote.booking.id)
                  }}
                >
                  Review & pay
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() =>
                    notify(
                      `Receipt for ${activeQuote.quote.id} sent to your email.`,
                    )
                  }
                >
                  View receipt
                </Button>
              )}
            </>
          }
        >
          <QuoteBreakdown
            booking={activeQuote.booking}
            quote={activeQuote.quote}
          />
          <p className="payment-note">
            Quotation {activeQuote.quote.id} is attached to booking CLM-
            {activeQuote.booking.id}.
          </p>
        </Dialog>
      )}

      {requestPackage && (
        <Dialog
          onClose={() => setRequestPackage(null)}
          eyebrow="Booking request"
          title={editingRequest ? "Edit your request" : "Plan your event"}
          intro={
            <>
              This is a demo only. Changes are kept in this browser session and are not sent to Clemora.
            </>
          }
        >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const nextBooking: CustomerBooking = {
                  id: editingRequest ?? Date.now(),
                  event: String(data.get("event")),
                  packageName: requestPackage,
                  eventType: String(data.get("type")),
                  date: String(data.get("date")),
                  venue: String(data.get("venue")),
                  guests: Number(data.get("guests")),
                  status: "Under review",
                }
                setCustomerBookings((items) =>
                  editingRequest
                    ? items.map((item) =>
                        item.id === editingRequest ? nextBooking : item,
                      )
                    : [nextBooking, ...items],
                )
                setRequestPackage(null)
                setEditingRequest(null)
                setTab("My events")
              }}
            >
              <div className="form-grid">
                <FormField label="Event name"><input name="event" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.event || ""} placeholder="e.g. Mendoza Anniversary" /></FormField>
                <FormField label="Event type"><select name="type" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.eventType || "Wedding"}><option>Wedding</option><option>Anniversary</option><option>Birthday</option><option>Corporate event</option><option>Family gathering</option><option>Other</option></select></FormField>
                <FormField label="Preferred date"><input name="date" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.date || ""} placeholder="e.g. Sep 20, 2025" /></FormField>
                <FormField label="Estimated guests"><input name="guests" type="number" min="1" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.guests || 50} /></FormField>
                <FormField className="full" label="Venue"><input name="venue" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.venue || ""} placeholder="Venue name or location" /></FormField>
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setRequestPackage(null)}>Cancel</Button>
                <Button type="submit">{editingRequest ? "Save demo changes" : "Save demo"}</Button>
              </div>
            </form>
        </Dialog>
      )}

      {activePayment && (
        <Dialog
          onClose={closePayment}
          className="payment-modal"
          eyebrow={
            paymentReference
              ? "Payment received"
              : `Quotation ${activePayment.quote.id} · Revision ${activePayment.quote.revision}`
          }
          title={paymentReference ? undefined : "Review quotation & pay"}
          intro={
            paymentReference ? undefined : (
              <>
                Review the approved quotation for{" "}
                <strong>{activePayment.booking.event}</strong>, then pay the
                reservation fee to secure your date.
              </>
            )
          }
          actions={
            paymentReference ? (
              <Button
                onClick={() => {
                  closePayment()
                  setTab("My events")
                }}
              >
                View my booking
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={closePayment}>
                  Cancel
                </Button>
                <Button icon="check" onClick={payReservationFee}>
                  Pay {money(activePayment.quote.reservationFee)} reservation fee
                </Button>
              </>
            )
          }
        >
          {paymentReference ? (
            <div className="success-state payment-success">
              <div className="success-icon">
                <Icon name="check" size={30} />
              </div>
              <div className="modal-title">Reservation fee received</div>
              <p>
                Your date is secured. The{" "}
                {money(activePayment.quote.reservationFee)} reservation fee has
                been credited toward your quotation total.
              </p>
              <div className="reference">
                Payment reference <strong>{paymentReference}</strong>
              </div>
              <div className="payment-success-summary">
                <span>
                  Remaining balance
                  <strong>
                    {money(
                      quoteTotal(activePayment.quote) -
                        activePayment.quote.reservationFee,
                    )}
                  </strong>
                </span>
                <span>
                  Booking
                  <strong>CLM-{activePayment.booking.id}</strong>
                </span>
              </div>
            </div>
          ) : (
            <>
              <QuoteBreakdown
                booking={activePayment.booking}
                quote={activePayment.quote}
              />

              <div className="payment-method">
                <div className="subheading">Payment method</div>
                <div className="payment-method-grid">
                  <button
                    type="button"
                    className={paymentMethod === "card" ? "active" : ""}
                    aria-pressed={paymentMethod === "card"}
                    onClick={() => setPaymentMethod("card")}
                  >
                    <span className="payment-method-icon">
                      <Icon name="card" />
                    </span>
                    <span>
                      <strong>Card</strong>
                      <small>Visa ending in 4242</small>
                    </span>
                    <span className="payment-method-check">
                      {paymentMethod === "card" && (
                        <Icon name="check" size={14} />
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={paymentMethod === "bank" ? "active" : ""}
                    aria-pressed={paymentMethod === "bank"}
                    onClick={() => setPaymentMethod("bank")}
                  >
                    <span className="payment-method-icon">
                      <Icon name="bank" />
                    </span>
                    <span>
                      <strong>Bank transfer</strong>
                      <small>Use booking reference</small>
                    </span>
                    <span className="payment-method-check">
                      {paymentMethod === "bank" && (
                        <Icon name="check" size={14} />
                      )}
                    </span>
                  </button>
                </div>
              </div>
              <p className="payment-note">
                Demo checkout — no card is charged and no transfer is
                initiated.
              </p>
            </>
          )}
        </Dialog>
      )}

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

