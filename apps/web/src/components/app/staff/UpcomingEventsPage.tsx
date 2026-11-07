import { useState, useEffect } from "react"
import { Badge, Button, Icon, type BadgeTone } from "@event-management/ui"
import { getStaffEvents, respondToEvent, ApiError } from "../../../lib/api"
import type { StaffEventData, AssignmentResponse } from "../../../lib/api"
import type { StaffEvent, AvailabilityResponse } from "./mockData"

// ─── API → UI shape mapper ─────────────────────────────────────────────────

function formatDate(iso: string | null, fallback: string): string {
  if (!iso) return fallback
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

function formatTime(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return ""
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return endsAt ? `${fmt(startsAt)} – ${fmt(endsAt)}` : fmt(startsAt)
}

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// booking_requests.status "accepted" is the confirmed event state for staff.
// Map any unexpected value through as-is so the UI degrades gracefully.
const STATUS_MAP: Record<string, StaffEvent["status"]> = {
  accepted: "confirmed",
  tentative: "tentative",
  cancelled: "cancelled",
  rescheduled: "rescheduled",
}

function fromApiEvent(e: StaffEventData): StaffEvent {
  const teamPublished = e.teamPublished
  const isSelected = teamPublished && e.selectedAt !== null

  return {
    id: e.id,
    title: e.eventType,
    date: formatDate(e.startsAt, e.preferredDate),
    time: formatTime(e.startsAt, e.endsAt),
    location: e.location ?? "",
    deadline: formatDeadline(e.responseDeadline),
    status: STATUS_MAP[e.status] ?? "confirmed",
    myResponse: e.response as AvailabilityResponse,
    teamStatus: teamPublished ? "published" : "pending",
    teamResult: teamPublished
      ? isSelected ? "selected" : "not-selected"
      : undefined,
    coordinator: e.coordinatorName ?? undefined,
    description: e.staffDescription ?? undefined,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StaffEvent["status"], string> = {
  confirmed: "Confirmed",
  tentative: "Tentative",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
}

const STATUS_TONE: Record<StaffEvent["status"], BadgeTone> = {
  confirmed: "success",
  tentative: "warning",
  cancelled: "neutral",
  rescheduled: "info",
}

const STATUS_ACCENT: Record<StaffEvent["status"], string> = {
  confirmed: "se-accent-confirmed",
  tentative: "se-accent-tentative",
  cancelled: "se-accent-cancelled",
  rescheduled: "se-accent-rescheduled",
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
            <Icon name="check" size={11} />
            You&rsquo;re on for this one
          </span>
          <div className="se-duty-eyebrow-right">
            {hasDetails && (
              <Button
                type="button"
                variant="secondary"
                className="se-duty-toggle"
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                aria-label={detailsOpen ? "Hide event details" : "Show event details"}
                onClick={() => setDetailsOpen((v) => !v)}
              >
                <Icon name="chevron" size={12} style={{ transition: "transform .2s ease", transform: detailsOpen ? "rotate(-90deg)" : "rotate(90deg)" }} />
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="se-duty-title">{event.title}</h2>

        {/* Horizontal meta strip */}
        <div className="se-duty-meta-strip" aria-label="Event details">
          <span><Icon name="calendar" size={13} />{event.date}</span>
          <span className="se-duty-meta-dot" aria-hidden="true" />
          <span><Icon name="clock" size={15} />{event.time}</span>
          <span className="se-duty-meta-dot" aria-hidden="true" />
          <span><Icon name="location" size={15} />{event.location}</span>
        </div>

        {/* Footer: team info */}
        <div className="se-duty-footer">
          <Badge tone="success">
            <Icon name="check" size={11} />
            You&rsquo;re on the team
          </Badge>
          {event.teamCount !== undefined && (
            <Badge tone="neutral">
              <Icon name="users" size={15} />
              {event.teamCount} members
            </Badge>
          )}
          {event.coordinator && (
            <Badge tone="neutral">
              {event.coordinator}
            </Badge>
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

// ─── Vote row ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  onRespond,
}: {
  event: StaffEvent
  onRespond: (id: string, response: AvailabilityResponse) => void
}) {
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleRespond = (response: AvailabilityResponse) => {
    setSaving(true)
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
          <Badge tone={STATUS_TONE[event.status]}>
            {STATUS_LABEL[event.status]}
          </Badge>
        </div>

        {/* Meta strip: date · time · location */}
        <div className="se-row-meta" aria-label="Event details">
          <span><Icon name="calendar" size={13} />{event.date}</span>
          <span className="se-row-meta-dot" aria-hidden="true" />
          <span><Icon name="clock" size={15} />{event.time}</span>
          <span className="se-row-meta-dot" aria-hidden="true" />
          <span><Icon name="location" size={15} />{event.location}</span>
        </div>

        {/* Deadline + details toggle */}
        {(event.deadline || hasDetails) && (
          <div className="se-meta-footer">
            {event.deadline && (
              <span className="se-meta-deadline-muted">
                <Icon name="alert" size={15} />
                Respond by {event.deadline}
              </span>
            )}
            {hasDetails && (
              <Button
                type="button"
                variant="light"
                className="se-detail-action"
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                onClick={() => setDetailsOpen((v) => !v)}
              >
                {detailsOpen ? "Less" : "More details"}
                <Icon name="chevron" size={12} style={{ transition: "transform .2s ease", transform: detailsOpen ? "rotate(-90deg)" : "rotate(90deg)" }} />
              </Button>
            )}
          </div>
        )}

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
                    <Button
                      type="button"
                      className="se-vote-action"
                      disabled={saving}
                      onClick={() => handleRespond("available")}
                      aria-label="Mark yourself as available for this event"
                    >
                      <Icon name="check" size={17} />
                      I'm available
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="se-vote-action"
                      disabled={saving}
                      onClick={() => handleRespond("unavailable")}
                      aria-label="Mark yourself as unavailable for this event"
                    >
                      <Icon name="close" size={17} />
                      Can't make it
                    </Button>
                  </div>
                  {saving && (
                    <p className="se-saving" role="status" aria-live="polite">
                      Saving…
                    </p>
                  )}
                </>
              ) : (
                <div className="se-vote-saved-row">
                  <Badge tone={event.myResponse === "available" ? "success" : "danger"}>
                    {event.myResponse === "available" ? (
                      <><Icon name="check" size={11} /> You&rsquo;re available</>
                    ) : (
                      <><Icon name="close" size={11} /> Unavailable</>
                    )}
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    className="se-change-action"
                    disabled={saving}
                    onClick={() => handleRespond(null)}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>
          )}

          {isCancelled && (
            <p className="se-cancelled-notice" role="note">
              <Icon name="close" size={14} />
              This event has been cancelled.
            </p>
          )}

          {/* Team status */}
          <div className="se-row-team">
            {event.teamStatus === "pending" ? (
              <p className="se-team-pending">
                <Icon name="users" size={15} />
                Team selection pending
              </p>
            ) : (
              <div className="se-team-published">
                <div className="se-team-row">
                  <Icon name="users" size={15} />
                  <span>Event team published</span>
                  {event.teamCount !== undefined && (
                    <Badge tone="neutral" className="se-team-count">{event.teamCount} members</Badge>
                  )}
                </div>
                {event.teamResult === "selected" ? (
                  <Badge tone="success">
                    <Icon name="check" size={11} />
                    You&rsquo;re on the team
                  </Badge>
                ) : (
                  <Badge tone="neutral">Not selected</Badge>
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
  const [events, setEvents] = useState<StaffEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getStaffEvents()
      .then(({ events: apiEvents }) => {
        setEvents(apiEvents.map(fromApiEvent))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setEvents([])
        } else {
          setFetchError("Could not load events. Please try again.")
        }
        setLoading(false)
      })
  }, [])

  const handleRespond = (id: string, response: AvailabilityResponse) => {
    // Capture snapshot for revert on failure.
    setEvents((prev) => {
      const snapshot = prev
      const next = prev.map((e) => (e.id === id ? { ...e, myResponse: response } : e))

      void respondToEvent(id, response as AssignmentResponse | null)
        .catch(() => setEvents(snapshot))

      return next
    })
  }

  const dutyEvents = events.filter(
    (e) => e.teamStatus === "published" && e.teamResult === "selected",
  )
  const votingEvents = events.filter(
    (e) => !(e.teamStatus === "published" && e.teamResult === "selected"),
  )
  const unanswered = votingEvents.filter((e) => e.myResponse === null && e.status !== "cancelled")
  const answered = votingEvents.filter((e) => e.myResponse !== null || e.status === "cancelled")

  if (loading) {
    return (
      <div className="se-page">
        <div className="se-empty">
          <p>Loading events…</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="se-page">
        <div className="se-empty">
          <Icon name="alert" size={26} />
          <p>{fetchError}</p>
        </div>
      </div>
    )
  }

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
