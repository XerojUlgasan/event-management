import { useState } from "react"
import { Icon } from "@event-management/ui"
import { mockChecklist, mockEvents, type ChecklistItem, type ChecklistStatus } from "./mockData"

const ASSIGNED_EVENT = mockEvents[2]

const STAGE_ORDER = [
  "Preparation & packing",
  "Travel & arrival",
  "Venue setup",
  "Final readiness",
  "Event proper",
  "Cleanup & closeout",
]

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

function ClockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  )
}

function AlertIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
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
    <button
      type="button"
      className={`cl-status-btn cl-status-${next} ${current === next ? "cl-status-active" : ""}`}
      onClick={onClick}
      aria-pressed={current === next}
    >
      {label}
    </button>
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
    setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    onUpdate(item.id, {
      status,
      actualTime:
        status === "done"
          ? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : undefined,
    })
    setSaving(false)
  }

  const handleSaveNote = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 400))
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
            <button
              type="button"
              className="cl-expand-btn"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              onClick={() => setExpanded((v) => !v)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s ease" }}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Time row */}
          {(item.plannedTime ?? item.actualTime) ? (
            <div className="cl-item-times">
              {item.plannedTime && (
                <span className="cl-time-planned">
                  <ClockIcon size={11} />
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
              <AlertIcon size={13} />
              {item.blockerNote}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span className={`cl-badge cl-badge-${item.status}`} aria-label={`Status: ${STATUS_LABEL[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
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
            <div className="cl-field">
              <label htmlFor={`blocker-${item.id}`} className="cl-field-label">
                Blocker description
              </label>
              <textarea
                id={`blocker-${item.id}`}
                className="cl-textarea"
                value={blockerInput}
                onChange={(e) => setBlockerInput(e.target.value)}
                placeholder="Describe what's blocking this item…"
                rows={2}
                maxLength={400}
              />
            </div>
          )}

          <div className="cl-field">
            <label htmlFor={`note-${item.id}`} className="cl-field-label">
              Notes <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            </label>
            <textarea
              id={`note-${item.id}`}
              className="cl-textarea"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add a note about this activity…"
              rows={2}
              maxLength={400}
            />
          </div>

          <div className="cl-field">
            <p className="cl-field-label">
              Photos <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            </p>
            <button type="button" className="cl-photo-btn" aria-label="Add photo from camera or gallery">
              <CameraIcon />
              {item.photoCount
                ? `${item.photoCount} photo${item.photoCount > 1 ? "s" : ""} — Add more`
                : "Add photo"}
            </button>
            <p className="cl-field-hint">Adding a photo does not mark this item as done.</p>
          </div>

          <div className="cl-expanded-footer">
            <button
              type="button"
              className="cl-save-btn"
              disabled={saving}
              onClick={() => { void handleSaveNote() }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="cl-cancel-btn" onClick={() => setExpanded(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function EventChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>(mockChecklist)

  const handleUpdate = (id: string, patch: Partial<ChecklistItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  const groups = groupByStage(items)
  const doneCount = items.filter((i) => i.status === "done").length
  const blockedCount = items.filter((i) => i.status === "blocked").length
  const totalCount = items.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div className="cl-page">
      {/* ── Event hero ── */}
      <div className="cl-event-hero" aria-label="Assigned event">
        <div className="cl-event-hero-inner">
          <p className="cl-event-hero-label">Assigned event</p>
          <h1 className="cl-event-hero-title">{ASSIGNED_EVENT.title}</h1>
          <div className="cl-event-hero-meta">
            <span>
              <Icon name="calendar" size={13} />
              {ASSIGNED_EVENT.date}
            </span>
            <span className="cl-event-hero-dot" aria-hidden="true" />
            <span>
              <ClockIcon size={13} />
              {ASSIGNED_EVENT.time}
            </span>
            <span className="cl-event-hero-dot" aria-hidden="true" />
            <span>{ASSIGNED_EVENT.location}</span>
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
              <span
                className={`cl-stage-count ${stageItems.every((i) => i.status === "done") ? "is-done" : ""}`}
              >
                {stageItems.filter((i) => i.status === "done").length}/{stageItems.length}
              </span>
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
