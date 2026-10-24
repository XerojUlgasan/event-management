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
} from "@event-management/ui"

import { photos } from "../data"
import type { EditablePackage } from "../data"

type CustomerTab =
  | "Home"
  | "My events"
  | "Packages"
  | "Quotations"
  | "Messages"
  | "Profile"

export function CustomerDashboard({
  onPublic,
  onTeamPortal,
  packageRows,
}: {
  onPublic: () => void
  onTeamPortal: () => void
  packageRows: EditablePackage[]
}) {
  const [tab, setTab] = useState<CustomerTab>("Home")
  const [notifications, setNotifications] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
  const [requestPackage, setRequestPackage] = useState<string | null>(null)
  const [editingRequest, setEditingRequest] = useState<number | null>(null)
  const [customerBookings, setCustomerBookings] = useState([
    { id: 2048, event: "Mendoza–Reyes Wedding", packageName: "The Signature Table", eventType: "Wedding", date: "Jun 22, 2025", venue: "The Glass Garden", guests: 180, status: "Confirmed" },
    { id: 5821, event: "Mendoza Family Brunch", packageName: "Garden Social", eventType: "Family gathering", date: "Aug 10, 2025", venue: "Mendoza Residence", guests: 60, status: "Under review" },
  ])
  const [profile, setProfile] = useState({
    name: "Elena Mendoza",
    email: "customer@clemora.demo",
    phone: "+1 555 014 2830",
  })

  const customerTabs: { label: CustomerTab; icon: string }[] = [
    { label: "Home", icon: "grid" },
    { label: "My events", icon: "calendar" },
    { label: "Packages", icon: "box" },
    { label: "Quotations", icon: "clipboard" },
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
          <button className="team-portal-link" onClick={onTeamPortal}>
            Owner login
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
            <span className="avatar">EM</span>
            <span>
              <strong>Elena Mendoza</strong>
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
                  <strong>$14,860.00</strong>
                </div>
                <div className="quote-lines">
                  <span>
                    Package · 180 guests <strong>$12,960</strong>
                  </span>
                  <span>
                    Styling & equipment <strong>$1,480</strong>
                  </span>
                  <span>
                    Dietary menu additions <strong>$420</strong>
                  </span>
                </div>
                <button
                  className="inline-link"
                  onClick={() => setTab("Quotations")}
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
                { value: "requests", label: "Requests", count: 1 },
                { value: "completed", label: "Completed", count: 2 },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            {customerBookings.map((booking) => (
              <div
                className={`customer-event-record panel ${booking.status === "Cancelled" ? "muted-record" : ""}`}
                key={booking.id}
              >
                <div className="event-record-top">
                  <div>
                    <Badge
                      tone={
                        booking.status === "Confirmed"
                          ? "success"
                          : booking.status === "Cancelled"
                            ? "danger"
                            : "warning"
                      }
                    >
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
                        : "The owner is reviewing your booking request."}
                  </span>
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
              description="Compare sample packages and choose a starting point for your event."
              actions={<Button icon="spark">Get a recommendation</Button>}
            />
            <div className="package-grid customer-package-grid">
              {packageRows
                .filter((item) => item.status === "Published")
                .map((item) => (
                <article className="package-card" key={item.name}>
                  <div className="package-image">
                    <img src={item.image} alt={item.kind} />
                    <Badge tone="light">{item.tag}</Badge>
                  </div>
                  <div className="package-body">
                    <div className="package-kind">{item.kind}</div>
                    <div className="card-title">{item.name}</div>
                    <p>{item.description}</p>
                    <div className="package-inclusions">
                      <strong>Includes</strong>
                      <span>{item.inclusions}</span>
                    </div>
                    <div className="package-meta">
                      <span>{item.price}</span><span>{item.guests}</span>
                    </div>
                    <Button
                      className="full-button"
                      onClick={() => {
                        setEditingRequest(null)
                        setRequestPackage(item.name)
                      }}
                    >
                      Request this package
                    </Button>
                  </div>
                </article>
                ))}
            </div>
          </div>
        )}

        {tab === "Quotations" && (
          <div className="customer-content">
            <PageHeader
              title="Quotations"
              description="Review pricing, revisions, approvals, and expiration dates."
              actions={<Button icon="clipboard">Request a quotation</Button>}
            />
            <div className="customer-quote panel">
              <div className="customer-quote-head">
                <span>
                  <small>QUOTATION Q-2048 · REVISION 2</small>
                  <strong>Mendoza–Reyes Wedding</strong>
                  <p>Prepared by Amina Santos · Approved June 8, 2025</p>
                </span>
                <span>
                  <Badge tone="success">Approved</Badge>
                  <strong>$14,860.00</strong>
                </span>
              </div>
              <div className="customer-quote-table">
                <div><span>Item</span><span>Qty</span><span>Amount</span></div>
                <div><strong>The Signature Table</strong><span>180</span><span>$12,960.00</span></div>
                <div><strong>Classic linen & table styling</strong><span>18</span><span>$1,080.00</span></div>
                <div><strong>Wireless microphone set</strong><span>2</span><span>$400.00</span></div>
                <div><strong>Dietary menu additions</strong><span>12</span><span>$420.00</span></div>
              </div>
              <div className="customer-quote-total">
                <span>Approved total</span><strong>$14,860.00</strong>
              </div>
              <div className="event-record-footer">
                <span>Approved quotations remain visible in your event record.</span>
                <div><Button variant="secondary">Download PDF</Button><Button>View full quotation</Button></div>
              </div>
            </div>
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
                  <small>Customer demo account</small>
                </span>
              </div>
              <div className="form-grid">
                <FormField className="full" label="Full name"><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></FormField>
                <FormField label="Email address"><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></FormField>
                <FormField label="Phone number"><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></FormField>
              </div>
              <div className="form-actions">
                <Button onClick={() => setTab("Home")}>Save account details</Button>
              </div>
            </Panel>
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

      {requestPackage && (
        <Dialog
          onClose={() => setRequestPackage(null)}
          eyebrow="Booking request"
          title={editingRequest ? "Edit your request" : "Plan your event"}
          intro={
            <>
              Package: <strong>{requestPackage}</strong>. This request remains
              editable until it is confirmed.
            </>
          }
        >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const nextBooking = {
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
                <FormField label="Event type"><select name="type" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.eventType || "Wedding"}><option>Wedding</option><option>Birthday</option><option>Corporate event</option><option>Family gathering</option><option>Other</option></select></FormField>
                <FormField label="Preferred date"><input name="date" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.date || ""} placeholder="e.g. Sep 20, 2025" /></FormField>
                <FormField label="Estimated guests"><input name="guests" type="number" min="1" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.guests || 50} /></FormField>
                <FormField className="full" label="Venue"><input name="venue" required defaultValue={customerBookings.find((item) => item.id === editingRequest)?.venue || ""} placeholder="Venue name or location" /></FormField>
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setRequestPackage(null)}>Cancel</Button>
                <Button type="submit">{editingRequest ? "Save changes" : "Submit request"}</Button>
              </div>
            </form>
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
    </div>
  )
}

