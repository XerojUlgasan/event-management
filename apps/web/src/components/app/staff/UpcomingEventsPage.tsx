import { useState } from "react"
import { Icon } from "@event-management/ui"
import {
  mockEvents,
  type AvailabilityResponse,
  type StaffEvent,
} from "./mockData"

const STATUS_LABEL: Record<StaffEvent["status"], string> = {
  confirmed: "Confirmed",
  tentative: "Tentative",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
}

const STATUS_TONE: Record<StaffEvent["status"], string> = {
  confirmed: "se-tone-confirmed",
  tentative: "se-tone-tentative",
  cancelled: "se-tone-cancelled",
  rescheduled: "se-tone-rescheduled",
}

const STATUS_ACCENT: Record<StaffEvent["status"], string> = {
  confirmed: "se-accent-confirmed",
  tentative: "se-accent-tentative",
  cancelled: "se-accent-cancelled",
  rescheduled: "se-accent-rescheduled",
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function DeadlineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transition: "transform .2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Pinned duty banner ────────────────────────────────────────────────────

function DutyBanner({ event }: { event: StaffEvent }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = `se-duty-details-${event.id}`
  const hasDetails = Boolean(event.description)

  return (
    <div className="se-duty-banner" aria-label={`Your confirmed assignment: ${event.title}`}>
      <div className="se-duty-body">
        {/* Eyebrow + expand toggle */}
        <div className="se-duty-eyebrow-row">
          <span className="se-duty-eyebrow">
            <CheckIcon size={11} />
            You&rsquo;re on for this one
          </span>
          <div className="se-duty-eyebrow-right">
            {hasDetails && (
              <button
                type="button"
                className="se-duty-expand"
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                aria-label={detailsOpen ? "Hide event details" : "Show event details"}
                onClick={() => setDetailsOpen((v) => !v)}
              >
                <ChevronIcon expanded={detailsOpen} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="se-duty-title">{event.title}</h2>

        {/* Horizontal meta strip */}
        <div className="se-duty-meta-strip" aria-label="Event details">
          <span><Icon name="calendar" size={13} />{event.date}</span>
          <span className="se-duty-meta-dot" aria-hidden="true" />
          <span><ClockIcon />{event.time}</span>
          <span className="se-duty-meta-dot" aria-hidden="true" />
          <span><LocationIcon />{event.location}</span>
        </div>

        {/* Footer: team info */}
        <div className="se-duty-footer">
          <span className="se-chip se-tone-selected">
            <CheckIcon size={11} />
            You&rsquo;re on the team
          </span>
          {event.teamCount !== undefined && (
            <span className="se-duty-meta-pill">
              <UsersIcon />
              {event.teamCount} members
            </span>
          )}
          {event.coordinator && (
            <span className="se-duty-meta-pill">
              {event.coordinator}
            </span>
          )}
        </div>

        {/* Collapsible details */}
        {hasDetails && (
          <div
            id={detailsId}
            className={`se-details-panel${detailsOpen ? " se-details-open" : ""}`}
            aria-hidden={!detailsOpen}
          >
            <p className="se-details-description">{event.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vote row (flat list item) ─────────────────────────────────────────────

function EventCard({
  event,
  onRespond,
}: {
  event: StaffEvent
  onRespond: (id: string, response: AvailabilityResponse) => void
}) {
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleRespond = async (response: AvailabilityResponse) => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    onRespond(event.id, response)
    setSaving(false)
  }

  const isCancelled = event.status === "cancelled"
  const answered = event.myResponse !== null
  const detailsId = `se-details-${event.id}`
  const hasDetails = Boolean(event.description)

  return (
    <article className="se-row" aria-label={event.title}>
      {/* Left: status dot */}
      <div className={`se-row-dot ${STATUS_ACCENT[event.status]}`} aria-hidden="true" />

      {/* Right: content */}
      <div className="se-row-body">

        {/* Title row */}
        <div className="se-row-head">
          <h2 className="se-row-title">{event.title}</h2>
          <span className={`se-chip ${STATUS_TONE[event.status]}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </div>

        {/* Meta strip: date · time · location */}
        <div className="se-row-meta" aria-label="Event details">
          <span><Icon name="calendar" size={13} />{event.date}</span>
          <span className="se-row-meta-dot" aria-hidden="true" />
          <span><ClockIcon />{event.time}</span>
          <span className="se-row-meta-dot" aria-hidden="true" />
          <span><LocationIcon />{event.location}</span>
        </div>

        {/* Deadline + details toggle */}
        <div className="se-meta-footer">
          <span className="se-meta-deadline-muted">
            <DeadlineIcon />
            Respond by {event.deadline}
          </span>
          {hasDetails && (
            <button
              type="button"
              className="se-details-toggle"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen((v) => !v)}
            >
              {detailsOpen ? "Less" : "More details"}
              <ChevronIcon expanded={detailsOpen} />
            </button>
          )}
        </div>

        {/* Collapsible description */}
        {hasDetails && (
          <div
            id={detailsId}
            className={`se-details-panel${detailsOpen ? " se-details-open" : ""}`}
            aria-hidden={!detailsOpen}
          >
            <p className="se-details-description">{event.description}</p>
          </div>
        )}

        {/* ── Action area ── */}
        <div className="se-row-action">
          {!isCancelled && (
            <div className="se-vote-section">
              {!answered ? (
                <>
                  <p className="se-vote-label">Are you available for this event?</p>
                  <div className="se-vote-buttons">
                    <button
                      type="button"
                      className="se-vote-btn se-vote-available"
                      disabled={saving}
                      onClick={() => { void handleRespond("available") }}
                      aria-label="Mark yourself as available for this event"
                    >
                      <CheckIcon size={17} />
                      I'm available
                    </button>
                    <button
                      type="button"
                      className="se-vote-btn se-vote-unavailable"
                      disabled={saving}
                      onClick={() => { void handleRespond("unavailable") }}
                      aria-label="Mark yourself as unavailable for this event"
                    >
                      <XIcon size={17} />
                      Can't make it
                    </button>
                  </div>
                  {saving && (
                    <p className="se-saving" role="status" aria-live="polite">
                      Saving…
                    </p>
                  )}
                </>
              ) : (
                <div className="se-vote-saved-row">
                  <span
                    className={`se-chip ${event.myResponse === "available" ? "se-tone-available" : "se-tone-unavailable"}`}
                  >
                    {event.myResponse === "available" ? (
                      <><CheckIcon size={11} /> You&rsquo;re available</>
                    ) : (
                      <><XIcon size={11} /> Unavailable</>
                    )}
                  </span>
                  <button
                    type="button"
                    className="se-btn-change"
                    disabled={saving}
                    onClick={() => { void handleRespond(null) }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          )}

          {isCancelled && (
            <p className="se-cancelled-notice" role="note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              This event has been cancelled.
            </p>
          )}

          {/* Team status */}
          <div className="se-row-team">
            {event.teamStatus === "pending" ? (
              <p className="se-team-pending">
                <UsersIcon />
                Team selection pending
              </p>
            ) : (
              <div className="se-team-published">
                <div className="se-team-row">
                  <UsersIcon />
                  <span>Event team published</span>
                  {event.teamCount !== undefined && (
                    <span className="se-team-count">{event.teamCount} members</span>
                  )}
                </div>
                {event.teamResult === "selected" ? (
                  <span className="se-chip se-tone-selected">
                    <CheckIcon size={11} />
                    You&rsquo;re on the team
                  </span>
                ) : (
                  <span className="se-chip se-tone-neutral">Not selected</span>
                )}
                {event.coordinator && (
                  <p className="se-coordinator">
                    Coordinator: <strong>{event.coordinator}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </article>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function UpcomingEventsPage({ displayName: _displayName }: { displayName?: string }) {
  const [events, setEvents] = useState<StaffEvent[]>(mockEvents)

  const handleRespond = (id: string, response: AvailabilityResponse) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, myResponse: response } : e)),
    )
  }

  // Duty = admin published the team and selected this staff member
  const dutyEvents = events.filter(
    (e) => e.teamStatus === "published" && e.teamResult === "selected",
  )
  // Voting pool excludes duty events
  const votingEvents = events.filter(
    (e) => !(e.teamStatus === "published" && e.teamResult === "selected"),
  )
  const unanswered = votingEvents.filter((e) => e.myResponse === null && e.status !== "cancelled")
  const answered = votingEvents.filter((e) => e.myResponse !== null || e.status === "cancelled")

  return (
    <div className="se-page">
      {/* ── Pinned duty events ── */}
      {dutyEvents.length > 0 && (
        <section aria-label="Your confirmed assignments">
          <div className="se-duty-stage">
            {dutyEvents.map((e) => (
              <DutyBanner key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* ── Voting sections ── */}
      {unanswered.length > 0 && (
        <section aria-label="Events awaiting your response">
          <h2 className="se-section-label">Needs your response ({unanswered.length})</h2>
          <div className="se-row-list">
            {unanswered.map((e) => (
              <EventCard key={e.id} event={e} onRespond={handleRespond} />
            ))}
          </div>
        </section>
      )}

      {answered.length > 0 && (
        <section aria-label="Events you have responded to">
          <h2 className="se-section-label">Responded</h2>
          <div className="se-row-list">
            {answered.map((e) => (
              <EventCard key={e.id} event={e} onRespond={handleRespond} />
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && (
        <div className="se-empty">
          <div className="se-empty-icon" aria-hidden="true">
            <Icon name="calendar" size={26} />
          </div>
          <p>No upcoming events yet.</p>
          <p className="se-empty-sub">Check back when the admin posts new events.</p>
        </div>
      )}
    </div>
  )
}
