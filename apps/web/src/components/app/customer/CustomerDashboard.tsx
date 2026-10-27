import { useState } from "react"
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
  const [tab, setTab] = useState<CustomerTab>("Home")
  const [notifications, setNotifications] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
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
  const [profile, setProfile] = useState({
    name: userName,
    email: userEmail,
    phone: "+1 555 014 2830",
  })

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
    { label: "Profile", icon: "settings" },
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
              {item.label === "Messages" && <b>2</b>}
            </button>
          ))}
        </nav>
        <div className="customer-header-actions">
          <button className="team-portal-link" onClick={onSignOut}>
            Sign out
          </button>
          <button
            className="notification-button"
            onClick={() => setNotifications(!notifications)}
            aria-label="Open notifications"
          >
            <Icon name="bell" />
            <b>2</b>
          </button>
          <div className="customer-profile">
            <span className="avatar">{initialsFromName(profile.name)}</span>
            <span>
              <strong>{profile.name}</strong>
              <small>Customer</small>
            </span>
            <Icon name="chevron" size={14} />
          </div>
        </div>
        {notifications && (
          <div className="notification-popover customer-notifications">
            <div className="panel-head">
              <div className="panel-title">Notifications</div>
              <button>Mark all read</button>
            </div>
            <button>
              <i></i>
              <span>
                <strong>Your booking is confirmed</strong>
                <small>
                  The Mendoza–Reyes Wedding is now confirmed for June 22.
                </small>
                <em>12 min ago</em>
              </span>
            </button>
            <button>
              <i></i>
              <span>
                <strong>New message from Amina</strong>
                <small>Your tasting appointment details are ready.</small>
                <em>1 hr ago</em>
              </span>
            </button>
            <a>View all notifications</a>
          </div>
        )}
      </header>

      <main className="customer-main">
        {tab !== "Packages" && <p role="note">This screen uses sample data. Requests, quotes, and payments shown here are not submitted.</p>}
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
            <PackageCatalog />
          </div>
        )}

        {tab === "Profile" && (
          <div className="customer-content">
            <PageHeader
              title="Account information"
              description="Manage the basic contact details used for your bookings."
            />
            <Panel className="customer-profile-form">
              <div className="manager-profile">
                <span className="manager-avatar">EM</span>
                <span>
                  <strong>{profile.name}</strong>
                  <small>Customer account</small>
                </span>
              </div>
              <div className="form-grid">
                <FormField className="full" label="Full name"><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></FormField>
                <FormField label="Email address"><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></FormField>
                <FormField label="Phone number"><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></FormField>
              </div>
              <div className="form-actions">
                <Button onClick={() => setTab("Home")}>Save account details</Button>
                <Button variant="secondary" onClick={onSignOut}>Sign out</Button>
              </div>
            </Panel>
            <SignInMethods />
          </div>
        )}

        {tab === "Messages" && (
          <div className="customer-content">
            <PageHeader
              title="Messages"
              description="Your conversations with the Clemora catering team."
            />
            <div className="customer-messages panel">
              <aside>
                <button className="active">
                  <span className="manager-avatar small">AS</span>
                  <span><strong>Amina Santos</strong><small>Your tasting appointment details...</small></span>
                  <em>10:32</em>
                </button>
                <button>
                  <span className="ai-icon"><Icon name="spark" size={15} /></span>
                  <span><strong>Clemora assistant</strong><small>Package recommendation saved</small></span>
                  <em>Jun 14</em>
                </button>
              </aside>
              <section>
                <div className="message-thread-head">
                  <span className="manager-avatar small">AS</span>
                  <span><strong>Amina Santos</strong><small>Online · Catering manager</small></span>
                  <Badge tone="success">Human support</Badge>
                </div>
                <div className="message-thread">
                  <span className="chat-time">Today</span>
                  <div className="message bot">
                    Hi Elena, everything is on track. Your tasting is confirmed
                    for Thursday at 3:30 PM at our studio.
                  </div>
                  <div className="message customer-message">
                    Wonderful, thank you. Can we review the vegetarian options
                    during the tasting?
                  </div>
                  <div className="message bot">
                    Absolutely. I’ve added that to your tasting notes and asked
                    the chef to prepare three options.
                  </div>
                </div>
                <div className="thread-input">
                  <input placeholder="Write a message to Amina..." />
                  <Button icon="arrow">Send</Button>
                </div>
              </section>
            </div>
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

      {messageOpen && (
        <Dialog
          onClose={() => setMessageOpen(false)}
          className="compact-modal"
          eyebrow="Message your manager"
          title="How can Amina help?"
          intro="Your event context and booking reference will be included."
          actions={
            <>
              <Button variant="secondary" onClick={() => setMessageOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => { setMessageOpen(false); setTab("Messages") }}>
                Send message
              </Button>
            </>
          }
        >
            <label className="message-compose">
              <span>Message</span>
              <textarea
                defaultValue="Hi Amina, I have a question about our upcoming event."
                autoFocus
              />
            </label>
        </Dialog>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  )
}

