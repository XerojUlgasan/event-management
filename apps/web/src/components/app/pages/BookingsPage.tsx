import { useState } from "react"
import {
  Badge,
  Button,
  Dialog,
  Drawer,
  FormField,
  Icon,
  PageHeader,
  SearchField,
  Tabs,
  Toast,
  Panel,
} from "@event-management/ui"

import { bookings } from "../data"

export function BookingsPage() {
  const [filter, setFilter] = useState("All bookings")
  const [query, setQuery] = useState("")
  const [bookingRows, setBookingRows] = useState(bookings)
  const [selected, setSelected] = useState<typeof bookings[0] | null>(null)
  const [editingBooking, setEditingBooking] = useState<
    (typeof bookings)[0] | null
  >(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState("")
  const [toast, setToast] = useState("")
  const filtered = bookingRows.filter(
    (item) =>
      `${item.event} ${item.customer} ${item.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All bookings" || item.status === filter),
  )
  return (
    <div className="content-stack">
      <PageHeader
        title="Bookings"
        description="Manage every confirmed and prospective event in one place."
        actions={
          <Button
            icon="clipboard"
            onClick={() => {
              setEditingBookingId(null)
              setEditingBooking({
                id: `CLM-${Date.now().toString().slice(-4)}`,
                event: "",
                customer: "",
                date: "",
                venue: "",
                guests: 50,
                status: "Under review",
                coordinator: "Owner",
              })
            }}
          >
            Create booking
          </Button>
        }
      />
      <Tabs
        active="all"
        items={[
          { value: "all", label: "All bookings", count: 28 },
          { value: "action", label: "Needs action", count: 7 },
          { value: "upcoming", label: "Upcoming" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ]}
      />
      <Panel className="table-panel">
        <div className="table-tools">
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search event, customer, or ID"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option>All bookings</option>
            <option>Confirmed</option>
            <option>In preparation</option>
            <option>Under review</option>
          </select>
          <select>
            <option>All coordinators</option>
            <option>Amina Santos</option>
            <option>Jon Bell</option>
          </select>
          <Button variant="secondary">More filters</Button>
        </div>
        <div className="data-table">
          <div className="table-row table-header">
            <span>Event</span>
            <span>Date & venue</span>
            <span>Guests</span>
            <span>Coordinator</span>
            <span>Status</span>
            <span></span>
          </div>
          {filtered.map((booking) => (
            <button
              className="table-row"
              key={booking.id}
              onClick={() => {
                setSelected(booking)
                setNewStatus(booking.status)
              }}
            >
              <span>
                <strong>{booking.event}</strong>
                <small>
                  {booking.id} · {booking.customer}
                </small>
              </span>
              <span>
                <strong>{booking.date}</strong>
                <small>{booking.venue}</small>
              </span>
              <span>{booking.guests}</span>
              <span>{booking.coordinator}</span>
              <span>
                <Badge
                  tone={
                    booking.status === "Confirmed"
                      ? "success"
                      : booking.status === "In preparation"
                        ? "info"
                        : "warning"
                  }
                >
                  {booking.status}
                </Badge>
              </span>
              <span>
                <Icon name="chevron" size={16} />
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <strong>No matching bookings</strong>
              <span>Try adjusting your search or filters.</span>
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("")
                  setFilter("All bookings")
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>Showing {filtered.length} of 28 bookings</span>
          <div>
            <button>‹</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </Panel>
      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <Badge tone="success">{selected.status}</Badge>
            <div className="drawer-title">{selected.event}</div>
            <p>{selected.id} · Created June 2, 2025</p>
            <div className="detail-grid">
              <div>
                <span>Customer</span>
                <strong>{selected.customer}</strong>
              </div>
              <div>
                <span>Event date</span>
                <strong>{selected.date}</strong>
              </div>
              <div>
                <span>Venue</span>
                <strong>{selected.venue}</strong>
              </div>
              <div>
                <span>Guest count</span>
                <strong>{selected.guests}</strong>
              </div>
            </div>
            <div className="subheading">Booking progress</div>
            <div className="vertical-timeline">
              {[
                "Request submitted",
                "Quotation approved",
                "Booking confirmed",
                "In preparation",
                "Event completed",
              ].map((step, index) => (
                <div
                  className={
                    index < 3 ? "complete" : index === 3 ? "current" : ""
                  }
                  key={step}
                >
                  <span>
                    <Icon name={index < 3 ? "check" : "grid"} size={13} />
                  </span>
                  <div>
                    <strong>{step}</strong>
                    <small>
                      {index < 3
                        ? `June ${index * 3 + 2}, 2025`
                        : index === 3
                          ? "Current stage"
                          : "Pending"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="booking-status-editor">
              <label>
                <span>Update booking status</span>
                <select
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value)}
                >
                  <option>Request submitted</option>
                  <option>Under review</option>
                  <option>Quotation sent</option>
                  <option>Awaiting confirmation</option>
                  <option>Confirmed</option>
                  <option>In preparation</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </label>
              <Button
                onClick={() => {
                  setBookingRows((items) =>
                    items.map((item) =>
                      item.id === selected.id
                        ? { ...item, status: newStatus }
                        : item,
                    ),
                  )
                  setSelected({ ...selected, status: newStatus })
                  setToast(`Booking ${selected.id} updated to ${newStatus}`)
                  window.setTimeout(() => setToast(""), 2200)
                }}
              >
                Save status
              </Button>
            </div>
            <div className="drawer-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setBookingRows((items) =>
                    items.filter((item) => item.id !== selected.id),
                  )
                  setSelected(null)
                }}
              >
                Delete
              </Button>
              <Button
                onClick={() => {
                  setEditingBookingId(selected.id)
                  setEditingBooking(selected)
                  setSelected(null)
                }}
              >
                Edit booking
              </Button>
            </div>
        </Drawer>
      )}
      {editingBooking && (
        <Dialog
          onClose={() => setEditingBooking(null)}
          eyebrow="Booking record"
          title={editingBookingId ? "Edit booking" : "Create booking"}
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditingBooking(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingBookingId) {
                  setBookingRows((items) => items.map((item) => item.id === editingBookingId ? editingBooking : item))
                } else {
                  setBookingRows((items) => [editingBooking, ...items])
                }
                setToast(`Booking ${editingBooking.id} saved`)
                window.setTimeout(() => setToast(""), 2200)
                setEditingBooking(null)
              }}>Save booking</Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField label="Event name"><input value={editingBooking.event} onChange={(event) => setEditingBooking({ ...editingBooking, event: event.target.value })} /></FormField>
            <FormField label="Customer"><input value={editingBooking.customer} onChange={(event) => setEditingBooking({ ...editingBooking, customer: event.target.value })} /></FormField>
            <FormField label="Preferred date"><input value={editingBooking.date} placeholder="Jun 30, 2025" onChange={(event) => setEditingBooking({ ...editingBooking, date: event.target.value })} /></FormField>
            <FormField label="Guest count"><input type="number" value={editingBooking.guests} onChange={(event) => setEditingBooking({ ...editingBooking, guests: Number(event.target.value) })} /></FormField>
            <FormField className="full" label="Venue"><input value={editingBooking.venue} onChange={(event) => setEditingBooking({ ...editingBooking, venue: event.target.value })} /></FormField>
            <FormField label="Status"><select value={editingBooking.status} onChange={(event) => setEditingBooking({ ...editingBooking, status: event.target.value })}><option>Under review</option><option>Confirmed</option><option>In preparation</option><option>Completed</option><option>Cancelled</option></select></FormField>
          </div>
        </Dialog>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  )
}

