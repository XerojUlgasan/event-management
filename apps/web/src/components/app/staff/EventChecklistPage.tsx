import { useState, useEffect } from "react"
import { Badge, Button, FormField, Icon, Textarea } from "@event-management/ui"
import { mockChecklist, mockEvents } from "./mockData"
import type { ChecklistItem, ChecklistStatus } from "./mockData"
import { getChecklist, updateChecklistItem, ApiError } from "../../../lib/api"
import type { Checklist } from "../../../lib/api"

import { CHECKLIST_STAGES } from "@event-management/contracts/limits/checklists"

const STAGE_ORDER = CHECKLIST_STAGES as readonly string[]

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  todo: "To do",
  done: "Done",
  blocked: "Blocked",
}

function groupByStage(items: ChecklistItem[]) {
  const groups: Record<string, ChecklistItem[]> = {}
  for (const item of items) {
    if (!groups[item.stage]) groups[item.stage] = []
    groups[item.stage].push(item)
  }
  return groups
}

/** Compute the dominant status of a stage for the pip indicator */
function stagePipClass(items: ChecklistItem[]): string {
  if (items.every((i) => i.status === "done")) return "is-done"
  if (items.some((i) => i.status !== "todo")) return "is-active"
  return ""
}

function StatusButton({
  current,
  next,
  label,
  onClick,
}: {
  current: ChecklistStatus
  next: ChecklistStatus
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant={current === next ? "primary" : "secondary"}
      className="cl-checklist-status-button"
      onClick={onClick}
      aria-pressed={current === next}
    >
      {label}
    </Button>
  )
}

function ChecklistItemRow({
  item,
  onUpdate,
  isLast,
}: {
  item: ChecklistItem
  onUpdate: (id: string, patch: Partial<ChecklistItem>) => void
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [blockerInput, setBlockerInput] = useState(item.blockerNote ?? "")
  const [noteInput, setNoteInput] = useState(item.notes ?? "")
  const [saving, setSaving] = useState(false)

  const handleStatus = async (status: ChecklistStatus) => {
    if (status === item.status) return
    onUpdate(item.id, {
      status,
      actualTime:
        status === "done"
          ? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : undefined,
    })
  }

  const handleSaveNote = async () => {
    setSaving(true)
    onUpdate(item.id, { notes: noteInput, blockerNote: blockerInput })
    setSaving(false)
  }

  return (
    <div className={`cl-item cl-item-${item.status}${isLast ? " cl-item-last" : ""}`}>
      <div className="cl-item-main">
        {/* Timeline track: dot + connector line */}
        <div className="cl-timeline-col" aria-hidden="true">
          <span className={`cl-dot cl-dot-${item.status}`} />
        </div>

        {/* Content */}
        <div className="cl-item-body">
          <div className="cl-item-row">
            <p className="cl-item-activity">{item.activity}</p>
            <Button
              variant="secondary"
              className="cl-checklist-expand"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              onClick={() => setExpanded((v) => !v)}
            >
              <Icon
                name="chevron"
                size={16}
                style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s ease" }}
              />
            </Button>
          </div>

          {/* Time row */}
          {(item.plannedTime ?? item.actualTime) ? (
            <div className="cl-item-times">
              {item.plannedTime && (
                <span className="cl-time-planned">
                  <Icon name="clock" size={11} />
                  {item.plannedTime}
                </span>
              )}
              {item.plannedTime && item.actualTime && (
                <span className="cl-time-sep" aria-hidden="true">·</span>
              )}
              {item.actualTime && (
                <span className="cl-time-actual">
                  Done {item.actualTime}
                </span>
              )}
            </div>
          ) : null}

          {/* Blocker callout */}
          {item.status === "blocked" && item.blockerNote && (
            <p className="cl-blocker-note">
              <Icon name="alert" size={13} />
              {item.blockerNote}
            </p>
          )}
        </div>

        {/* Status badge */}
        <Badge tone={item.status === "done" ? "success" : item.status === "blocked" ? "danger" : "neutral"} aria-label={`Status: ${STATUS_LABEL[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </Badge>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="cl-item-expanded">
          <div className="cl-status-row" role="group" aria-label="Update status">
            <span className="cl-status-row-label">Status</span>
            <StatusButton current={item.status} next="todo" label="To do" onClick={() => { void handleStatus("todo") }} />
            <StatusButton current={item.status} next="done" label="Done" onClick={() => { void handleStatus("done") }} />
            <StatusButton current={item.status} next="blocked" label="Blocked" onClick={() => { void handleStatus("blocked") }} />
          </div>

          {item.status === "blocked" && (
            <FormField className="cl-field" label={<span className="cl-field-label">Blocker description</span>}>
              <Textarea
                id={`blocker-${item.id}`}
                className="cl-textarea"
                value={blockerInput}
                onChange={(e) => setBlockerInput(e.target.value)}
                placeholder="Describe what's blocking this item…"
                rows={2}
                maxLength={400}
              />
            </FormField>
          )}

          <FormField className="cl-field" label={<span className="cl-field-label">Notes <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span></span>}>
            <Textarea
              id={`note-${item.id}`}
              className="cl-textarea"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add a note about this activity…"
              rows={2}
              maxLength={400}
            />
          </FormField>

          <div className="cl-field">
            <p className="cl-field-label">
              Photos <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            </p>
            <Button variant="secondary" className="cl-checklist-photo" aria-label="Add photo from camera or gallery">
              <Icon name="camera" size={16} />
              {item.photoCount
                ? `${item.photoCount} photo${item.photoCount > 1 ? "s" : ""} — Add more`
                : "Add photo"}
            </Button>
            <p className="cl-field-hint">Adding a photo does not mark this item as done.</p>
          </div>

          <div className="cl-expanded-footer">
            <Button
              disabled={saving}
              onClick={() => { void handleSaveNote() }}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="secondary" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Map a real API ChecklistItem to the local ChecklistItem shape used by the UI. */
function fromApiItem(apiItem: Checklist["items"][number]): ChecklistItem {
  return {
    id: apiItem.id,
    stage: apiItem.stage,
    activity: apiItem.activity,
    plannedTime: apiItem.plannedTime ?? undefined,
    actualTime: apiItem.actualTime ?? undefined,
    status: apiItem.status as ChecklistStatus,
    blockerNote: apiItem.blockerNote ?? undefined,
    notes: apiItem.notes ?? undefined,
    photoCount: apiItem.photoCount,
  }
}

export function EventChecklistPage({
  bookingRequestId,
  eventTitle: eventTitleProp,
}: {
  bookingRequestId?: string
  eventTitle?: string
}) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [eventTitle, setEventTitle] = useState<string>(eventTitleProp ?? "")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Real assigned event (mock fallback when no bookingRequestId is provided)
  const ASSIGNED_EVENT = mockEvents[2]

  useEffect(() => {
    if (!bookingRequestId) {
      // No booking request yet — fall back to mock data
      setItems(mockChecklist)
      setEventTitle(ASSIGNED_EVENT.title)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    getChecklist(bookingRequestId)
      .then(({ checklist }) => {
        setItems(checklist.items.map(fromApiItem))
        // Event title will be provided by the parent when available;
        // clear any stale mock title so displayTitle falls through correctly.
        setEventTitle("")
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setItems([])
        } else {
          setError("Could not load checklist. Please try again.")
        }
        setLoading(false)
      })
  }, [bookingRequestId])

  const handleUpdate = (id: string, patch: Partial<ChecklistItem>) => {
    // Capture snapshot before the optimistic update so we can revert on failure.
    setItems((prev) => {
      const snapshot = prev
      const next = prev.map((i) => (i.id === id ? { ...i, ...patch } : i))

      if (bookingRequestId) {
        void updateChecklistItem(bookingRequestId, id, {
          status: patch.status,
          actualTime: patch.actualTime ?? null,
          blockerNote: patch.blockerNote ?? null,
          notes: patch.notes ?? null,
        }).catch(() => setItems(snapshot))
      }

      return next
    })
  }

  const groups = groupByStage(items)
  const doneCount = items.filter((i) => i.status === "done").length
  const blockedCount = items.filter((i) => i.status === "blocked").length
  const totalCount = items.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const displayTitle = eventTitle || ASSIGNED_EVENT.title
  const displayDate = ASSIGNED_EVENT.date
  const displayTime = ASSIGNED_EVENT.time
  const displayLocation = ASSIGNED_EVENT.location

  if (loading) {
    return (
      <div className="cl-page">
        <div className="se-empty">
          <p>Loading checklist…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="cl-page">
        <div className="se-empty">
          <Icon name="alert" size={26} />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cl-page">
      {/* ── Event hero ── */}
      <div className="cl-event-hero" aria-label="Assigned event">
        <div className="cl-event-hero-inner">
          <p className="cl-event-hero-label">Assigned event</p>
          <h1 className="cl-event-hero-title">{displayTitle}</h1>
          <div className="cl-event-hero-meta">
            <span>
              <Icon name="calendar" size={13} />
              {displayDate}
            </span>
            <span className="cl-event-hero-dot" aria-hidden="true" />
            <span>
              <Icon name="clock" size={13} />
              {displayTime}
            </span>
            <span className="cl-event-hero-dot" aria-hidden="true" />
            <span>{displayLocation}</span>
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div
        className="cl-progress-bar-wrap"
        aria-label={`${doneCount} of ${totalCount} items done`}
      >
        <div className="cl-progress-stats">
          <div className="cl-progress-stat">
            <span className="cl-progress-stat-value is-done">{doneCount}</span>
            <span className="cl-progress-stat-label">Done</span>
          </div>
          <div className="cl-progress-stat-sep" aria-hidden="true" />
          {blockedCount > 0 && (
            <>
              <div className="cl-progress-stat">
                <span className="cl-progress-stat-value is-blocked">{blockedCount}</span>
                <span className="cl-progress-stat-label">Blocked</span>
              </div>
              <div className="cl-progress-stat-sep" aria-hidden="true" />
            </>
          )}
          <div className="cl-progress-stat">
            <span className="cl-progress-stat-value">{totalCount - doneCount}</span>
            <span className="cl-progress-stat-label">Remaining</span>
          </div>
        </div>
        <div className="cl-progress-labels">
          <span>{pct}% complete</span>
          <span className="cl-progress-pct">{doneCount}/{totalCount} items</span>
        </div>
        <div
          className="cl-progress-track"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${pct}% complete`}
        >
          <div
            className="cl-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      {STAGE_ORDER.filter((stage) => groups[stage]?.length).map((stage) => {
        const stageItems = groups[stage]
        const pipClass = stagePipClass(stageItems)
        return (
          <section key={stage} className="cl-stage">
            <div className="cl-stage-header">
              <div className="cl-stage-title-wrap">
                <span className={`cl-stage-pip ${pipClass}`} aria-hidden="true" />
                <h2 className={`cl-stage-title ${pipClass}`}>{stage}</h2>
              </div>
              <Badge tone={stageItems.every((i) => i.status === "done") ? "success" : "neutral"}>
                {stageItems.filter((i) => i.status === "done").length}/{stageItems.length}
              </Badge>
            </div>
            <div className="cl-item-list">
              {stageItems.map((item, idx) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdate}
                  isLast={idx === stageItems.length - 1}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="se-empty">
          <div className="se-empty-icon" aria-hidden="true">
            <Icon name="clipboard" size={26} />
          </div>
          <p>No checklist prepared yet.</p>
          <p className="se-empty-sub">The admin will prepare the checklist before the event.</p>
        </div>
      )}
    </div>
  )
}
