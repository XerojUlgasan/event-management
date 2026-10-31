import { useState } from "react"
import {
  Badge,
  Button,
  Dialog,
  Drawer,
  Icon,
  PageHeader,
  Panel,
} from "@event-management/ui"

export function CalendarPage() {
  const [mode, setMode] = useState<"Month" | "Week" | "Day">("Month")
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)
  const days = [
    { day: 26, muted: true },
    { day: 27, muted: true },
    { day: 28, muted: true },
    { day: 29, muted: true },
    { day: 30, muted: true },
    { day: 31, muted: true },
    { day: 1 },
    { day: 2 },
    { day: 3, events: [["Tasting · Mendoza", "tasting"]] },
    { day: 4 },
    { day: 5, events: [["Team training", "internal"]] },
    { day: 6 },
    { day: 7, events: [["Bennett Anniversary", "confirmed"]] },
    { day: 8 },
    { day: 9 },
    { day: 10, events: [["Venue walkthrough", "tasting"]] },
    { day: 11 },
    { day: 12, events: [["Reed Graduation", "confirmed"]] },
    { day: 13 },
    { day: 14, events: [["Garden Social", "preparation"]] },
    { day: 15 },
    { day: 16, today: true },
    { day: 17 },
    { day: 18, events: [["Final guest count", "attention"]] },
    { day: 19, events: [["Menu tasting", "tasting"]] },
    { day: 20 },
    {
      day: 21,
      events: [
        ["Kitchen production", "preparation"],
        ["Equipment dispatch", "internal"],
      ],
    },
    {
      day: 22,
      events: [["Mendoza–Reyes Wedding", "confirmed"]],
    },
    { day: 23 },
    {
      day: 24,
      conflict: true,
      events: [
        ["Northstar Dinner", "preparation"],
        ["Captain assignment conflict", "attention"],
      ],
    },
    { day: 25 },
    { day: 26 },
    { day: 27, events: [["Harlow Birthday", "pending"]] },
    { day: 28 },
    { day: 29, events: [["Arc & Co. Launch", "pending"]] },
    { day: 30 },
    { day: 1, muted: true },
    { day: 2, muted: true },
    { day: 3, muted: true },
    { day: 4, muted: true },
    { day: 5, muted: true },
    { day: 6, muted: true },
  ]

  return (
    <div className="content-stack calendar-page">
      <PageHeader
        title="Schedule"
        description="Coordinate events, staff, transport, preparation, and equipment."
        actions={
          <div className="welcome-actions">
            <Button variant="secondary">Check availability</Button>
            <Button icon="calendar">Schedule event</Button>
          </div>
        }
      />

      <div className="schedule-summary">
        <div>
          <span className="schedule-dot confirmed"></span>
          <span><strong>12</strong> Events this month</span>
        </div>
        <div>
          <span className="schedule-dot preparation"></span>
          <span><strong>4</strong> In preparation</span>
        </div>
        <div>
          <span className="schedule-dot attention"></span>
          <span><strong>2</strong> Conflicts to resolve</span>
        </div>
        <button onClick={() => setConflictOpen(true)}>
          Review conflicts <Icon name="arrow" size={14} />
        </button>
      </div>

      <div className="calendar-layout">
        <Panel className="calendar-panel">
          <div className="calendar-toolbar">
            <div className="month-selector">
              <button aria-label="Previous month">‹</button>
              <strong>June 2025</strong>
              <button aria-label="Next month">›</button>
              <button className="today-button">Today</button>
            </div>
            <div className="calendar-modes">
              {(["Month", "Week", "Day"] as const).map((item) => (
                <button
                  className={mode === item ? "active" : ""}
                  onClick={() => setMode(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {mode === "Month" ? (
            <div className="month-calendar">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day) => (
                  <div className="weekday" key={day}>{day}</div>
                ),
              )}
              {days.map((day, index) => (
                <div
                  className={`calendar-day ${day.muted ? "muted" : ""} ${day.today ? "today" : ""} ${day.conflict ? "has-conflict" : ""}`}
                  key={`${day.day}-${index}`}
                >
                  <span className="day-number">{day.day}</span>
                  {day.conflict && (
                    <button
                      className="conflict-indicator"
                      onClick={() => setConflictOpen(true)}
                      aria-label="View scheduling conflict"
                    >
                      <Icon name="alert" size={12} />
                    </button>
                  )}
                  <div className="calendar-events">
                    {day.events?.map((event) => (
                      <button
                        className={`calendar-event ${event[1]}`}
                        key={event[0]}
                        onClick={() => setSelectedEvent(event[0])}
                      >
                        <i></i>
                        <span>{event[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="agenda-view">
              <div className="agenda-hours">
                {["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM"].map(
                  (hour) => <span key={hour}>{hour}</span>,
                )}
              </div>
              <div className="agenda-columns">
                {(mode === "Week"
                  ? ["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20"]
                  : ["Monday, June 16"]
                ).map((day, index) => (
                  <div key={day}>
                    <strong>{day}</strong>
                    {index === 0 && (
                      <>
                        <button
                          className="agenda-event event-one"
                          onClick={() => setSelectedEvent("Kitchen briefing")}
                        >
                          <span>9:00 AM</span>
                          <strong>Kitchen briefing</strong>
                          <small>Production kitchen</small>
                        </button>
                        <button
                          className="agenda-event event-two"
                          onClick={() => setSelectedEvent("Venue walkthrough")}
                        >
                          <span>2:00 PM</span>
                          <strong>Venue walkthrough</strong>
                          <small>The Glass Garden</small>
                        </button>
                      </>
                    )}
                    {index === 2 && (
                      <button
                        className="agenda-event event-three"
                        onClick={() => setConflictOpen(true)}
                      >
                        <span>3:30 PM</span>
                        <strong>Assignment conflict</strong>
                        <small>2 service captains</small>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <aside className="calendar-side">
          <Panel title="Monday, June 16" description="3 scheduled activities">
            <div className="day-agenda-list">
              <button onClick={() => setSelectedEvent("Kitchen briefing")}>
                <span className="agenda-time">9:00</span>
                <span>
                  <strong>Kitchen briefing</strong>
                  <small>Production kitchen · 8 staff</small>
                </span>
                <Badge tone="neutral">Internal</Badge>
              </button>
              <button onClick={() => setSelectedEvent("Venue walkthrough")}>
                <span className="agenda-time">2:00</span>
                <span>
                  <strong>Venue walkthrough</strong>
                  <small>The Glass Garden · Amina Santos</small>
                </span>
                <Badge tone="info">Visit</Badge>
              </button>
              <button onClick={() => setSelectedEvent("Supplier delivery")}>
                <span className="agenda-time">4:30</span>
                <span>
                  <strong>Supplier delivery</strong>
                  <small>Warehouse · Fresh produce</small>
                </span>
                <Badge tone="success">Confirmed</Badge>
              </button>
            </div>
          </Panel>
          <Panel
            className="availability-card"
            title="Team availability"
            action={<strong>86%</strong>}
          >
            <div className="availability-bar">
              <span></span>
            </div>
            <div className="availability-lines">
              <span><i className="available"></i>32 available</span>
              <span><i className="assigned"></i>11 assigned</span>
              <span><i className="away"></i>5 unavailable</span>
            </div>
          </Panel>
          <Panel className="resource-calendar-card">
            <div className="panel-title">Resource pressure</div>
            <p>June 21–24 is your busiest allocation window.</p>
            <div>
              <span>Service kits <strong>92% reserved</strong></span>
              <span>Transport <strong>80% reserved</strong></span>
              <span>Warming units <strong>100% reserved</strong></span>
            </div>
            <button className="inline-link">
              Review resource schedule <Icon name="arrow" size={14} />
            </button>
          </Panel>
        </aside>
      </div>

      {selectedEvent && (
        <Drawer
          onClose={() => setSelectedEvent(null)}
          className="schedule-drawer"
        >
            <Badge tone="info">Scheduled activity</Badge>
            <div className="drawer-title">{selectedEvent}</div>
            <p>Monday, June 16, 2025</p>
            <div className="schedule-detail-time">
              <Icon name="calendar" />
              <span><strong>2:00–3:00 PM</strong><small>1 hour</small></span>
            </div>
            <div className="detail-grid">
              <div><span>Location</span><strong>The Glass Garden</strong></div>
              <div><span>Owner</span><strong>Amina Santos</strong></div>
              <div><span>Related event</span><strong>CLM-2048</strong></div>
              <div><span>Attendees</span><strong>4 people</strong></div>
            </div>
            <div className="subheading">Preparation notes</div>
            <div className="schedule-note">
              Confirm loading entrance, service station placement, kitchen
              access, and guest arrival route with the venue coordinator.
            </div>
            <div className="drawer-actions">
              <Button variant="secondary">Reschedule</Button>
              <Button>Open related event</Button>
            </div>
        </Drawer>
      )}

      {conflictOpen && (
        <Dialog
          onClose={() => setConflictOpen(false)}
          className="conflict-modal"
          eyebrow="Scheduling conflict"
          title="Two assignments overlap"
          intro="Devon Price and Mia Chen are assigned to events with overlapping travel and preparation windows on June 24."
          actions={
            <>
              <Button variant="secondary" onClick={() => setConflictOpen(false)}>
                Decide later
              </Button>
              <Button onClick={() => setConflictOpen(false)}>
                Review reassignment
              </Button>
            </>
          }
        >
          <div className="conflict-comparison">
            <div>
              <Badge tone="info">Northstar Dinner</Badge>
              <strong>Orchid Hall</strong>
              <span>2:00–11:00 PM · Lead service captain</span>
              <small>Travel buffer required: 45 min</small>
            </div>
            <span>overlaps</span>
            <div>
              <Badge tone="warning">Private tasting</Badge>
              <strong>Clemora Studio</strong>
              <span>1:30–3:30 PM · Tasting lead</span>
              <small>Current end time leaves no travel buffer</small>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

