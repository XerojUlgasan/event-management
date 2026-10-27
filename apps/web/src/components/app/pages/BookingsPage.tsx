import { useCallback, useEffect, useState } from "react"
import {
  Badge,
  Button,
  Dialog,
  Drawer,
  FormField,
  Icon,
  PageHeader,
  Panel,
  SearchField,
  Tabs,
  Toast,
} from "@event-management/ui"
import {
  createBooking,
  deleteBooking,
  listBookings,
  updateBooking,
  updateBookingStatus,
} from "../../../lib/api"
import type { Booking, BookingStatus } from "../../../lib/api"
import {
  BOOKING_STATUSES,
  COORDINATORS,
  STATUS_LABELS,
  STATUS_TONE,
} from "../../../lib/booking-constants"
import {
  emptyForm,
  formatDate,
  formFrom,
  getTabFilter,
  toBookingStatus,
  toISODateTime,
  useBookingMutation,
  validate,
} from "../../../lib/booking-utils"
import type { BookingForm } from "../../../lib/booking-utils"
import { message, useFormState } from "../../../lib/form-utils"

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
}

function ErrorMessage({
  text,
  onRetry,
}: {
  text: string
  onRetry?: () => void
}) {
  return (
    <div className="form-error" role="alert">
      {text}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

function BookingFormDialog({
  isEditing,
  form,
  errors,
  busy,
  actionError,
  onFieldChange,
  onSave,
  onClose,
}: {
  isEditing: boolean
  form: BookingForm
  errors: Record<string, string>
  busy: boolean
  actionError: string
  onFieldChange: (key: keyof BookingForm, value: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      onClose={onClose}
      eyebrow="Booking record"
      title={isEditing ? "Edit booking" : "Create booking"}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {isEditing ? "Save changes" : "Create booking"}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {!isEditing && (
          <FormField label="Customer ID *" className="full">
            <input
              type="text"
              value={form.customerId}
              onChange={(e) => onFieldChange("customerId", e.target.value)}
              placeholder="UUID of the customer account"
              aria-invalid={!!errors.customerId}
            />
            {errors.customerId && (
              <span className="field-error">{errors.customerId}</span>
            )}
          </FormField>
        )}

        <FormField label="Event name *" className="full">
          <input
            type="text"
            value={form.eventName}
            onChange={(e) => onFieldChange("eventName", e.target.value)}
            placeholder="e.g. Santos Wedding Reception"
            aria-invalid={!!errors.eventName}
          />
          {errors.eventName && (
            <span className="field-error">{errors.eventName}</span>
          )}
        </FormField>

        <FormField label="Event date *">
          <input
            type="date"
            value={form.eventDate}
            onChange={(e) => onFieldChange("eventDate", e.target.value)}
            aria-invalid={!!errors.eventDate}
          />
          {errors.eventDate && (
            <span className="field-error">{errors.eventDate}</span>
          )}
        </FormField>

        <FormField label="Guest count *">
          <input
            type="number"
            min={1}
            value={form.guestCount}
            onChange={(e) => onFieldChange("guestCount", e.target.value)}
            aria-invalid={!!errors.guestCount}
          />
          {errors.guestCount && (
            <span className="field-error">{errors.guestCount}</span>
          )}
        </FormField>

        <FormField label="Coordinator">
          <select
            value={form.coordinator}
            onChange={(e) => onFieldChange("coordinator", e.target.value)}
          >
            {COORDINATORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Special notes" className="full">
          <textarea
            value={form.specialNotes}
            onChange={(e) => onFieldChange("specialNotes", e.target.value)}
            placeholder="Any special requirements or notes"
            rows={3}
          />
        </FormField>

        {actionError && <ErrorMessage text={actionError} />}
      </div>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterCoordinator, setFilterCoordinator] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  const [selected, setSelected] = useState<Booking | null>(null)
  const [newStatus, setNewStatus] = useState<BookingStatus>("under_review")
  const [statusError, setStatusError] = useState("")
  const [drawerActionError, setDrawerActionError] = useState("")

  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [dialogError, setDialogError] = useState("")
  const { form, setField, errors, setErrors, reset } =
    useFormState<BookingForm>(emptyForm)

  const [confirm, setConfirm] = useState<Booking | null>(null)
  const [notice, setNotice] = useState("")

  const { busy, mutate } = useBookingMutation()

  // ── Load ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const data = await listBookings()
      setRows(data.bookings)
    } catch (err) {
      setLoadError(message(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // ── Derived ───────────────────────────────────────────────────────────

  const tabFilter = getTabFilter(activeTab)

  const visible = rows.filter((b) => {
    const search = query.toLowerCase().trim()
    const matchSearch =
      !search ||
      `${b.eventName} ${b.customerName ?? ""} ${b.customerEmail} ${b.id}`
        .toLowerCase()
        .includes(search)
    const matchStatus = !filterStatus || b.status === filterStatus
    const matchCoord = !filterCoordinator || b.coordinator === filterCoordinator
    return tabFilter(b) && matchSearch && matchStatus && matchCoord
  })

  const countFor = (tab: string) => rows.filter(getTabFilter(tab)).length

  // ── Toast ─────────────────────────────────────────────────────────────

  const showNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(""), 2500)
  }

  // ── Drawer ────────────────────────────────────────────────────────────

  const openDrawer = (b: Booking) => {
    setSelected(b)
    setNewStatus(b.status)
    setStatusError("")
    setDrawerActionError("")
  }

  // ── Status update ─────────────────────────────────────────────────────

  const saveStatus = async () => {
    if (!selected) return
    setStatusError("")
    try {
      await mutate(
        () => updateBookingStatus(selected.id, newStatus),
        async () => {
          // mutate doesn't expose the return value; fetch the updated row
          const data = await listBookings()
          const updated = data.bookings.find((b) => b.id === selected.id)
          if (updated) {
            setRows(data.bookings)
            setSelected(updated)
          }
          showNotice(`Status updated to "${STATUS_LABELS[newStatus]}".`)
        },
      )
    } catch (err) {
      setStatusError(message(err))
    }
  }

  // ── Create / Edit ─────────────────────────────────────────────────────

  const openCreate = () => {
    reset()
    setErrors({})
    setDialogError("")
    setEditing({ id: null })
  }

  const openEdit = (b: Booking) => {
    const f = formFrom(b)
    Object.entries(f).forEach(([k, v]) =>
      setField(k as keyof BookingForm, v as string),
    )
    setErrors({})
    setDialogError("")
    setEditing({ id: b.id })
    setSelected(null)
  }

  const save = async () => {
    if (!editing) return
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setDialogError("")
    try {
      if (editing.id) {
        await mutate(
          () =>
            updateBooking(editing.id!, {
              eventName: form.eventName.trim(),
              eventDate: toISODateTime(form.eventDate),
              guestCount: Number(form.guestCount),
              specialNotes: form.specialNotes.trim() || null,
              coordinator: form.coordinator,
            }),
          () => {
            load()
            showNotice("Booking updated.")
            setEditing(null)
          },
        )
      } else {
        await mutate(
          () =>
            createBooking({
              customerId: form.customerId.trim(),
              eventName: form.eventName.trim(),
              eventDate: toISODateTime(form.eventDate),
              guestCount: Number(form.guestCount),
              specialNotes: form.specialNotes.trim() || undefined,
              coordinator: form.coordinator,
            }),
          () => {
            load()
            showNotice("Booking created.")
            setEditing(null)
          },
        )
      }
    } catch (err) {
      setDialogError(message(err))
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!confirm) return
    const target = confirm
    try {
      await mutate(
        () => deleteBooking(target.id),
        () => {
          setRows((prev) => prev.filter((r) => r.id !== target.id))
          setConfirm(null)
          setSelected(null)
          showNotice("Booking deleted.")
        },
      )
    } catch (err) {
      setDrawerActionError(message(err))
      setConfirm(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  const clearFilters = () => {
    setQuery("")
    setFilterStatus("")
    setFilterCoordinator("")
  }

  return (
    <div className="content-stack">
      <PageHeader
        title="Bookings"
        description="Manage every confirmed and prospective event in one place."
        actions={
          <Button icon="clipboard" onClick={openCreate} disabled={busy}>
            Create booking
          </Button>
        }
      />

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        items={[
          { value: "all", label: "All bookings", count: rows.length },
          { value: "action", label: "Needs action", count: countFor("action") },
          { value: "upcoming", label: "Upcoming", count: countFor("upcoming") },
          { value: "completed", label: "Completed", count: countFor("completed") },
          { value: "cancelled", label: "Cancelled", count: countFor("cancelled") },
        ]}
      />

      {loadError && (
        <ErrorMessage text={loadError} onRetry={() => void load()} />
      )}

      <Panel className="table-panel">
        <div className="table-tools">
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search event, customer, or ID"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={filterCoordinator}
            onChange={(e) => setFilterCoordinator(e.target.value)}
            aria-label="Filter by coordinator"
          >
            <option value="">All coordinators</option>
            {COORDINATORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(query || filterStatus || filterCoordinator) && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        <div className="data-table" aria-busy={loading}>
          <div className="table-row table-header">
            <span>Event</span>
            <span>Date</span>
            <span>Guests</span>
            <span>Coordinator</span>
            <span>Status</span>
            <span></span>
          </div>

          {loading && (
            <div className="empty-state">
              <span>Loading bookings…</span>
            </div>
          )}

          {!loading &&
            visible.map((b) => (
              <button
                className="table-row"
                key={b.id}
                onClick={() => openDrawer(b)}
              >
                <span>
                  <strong>{b.eventName}</strong>
                  <small>
                    {b.id.slice(0, 8)} · {b.customerName ?? b.customerEmail}
                  </small>
                </span>
                <span>
                  <strong>{formatDate(b.eventDate)}</strong>
                </span>
                <span>{b.guestCount}</span>
                <span>{b.coordinator}</span>
                <span>
                  <StatusBadge status={b.status} />
                </span>
                <span>
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            ))}

          {!loading && visible.length === 0 && !loadError && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <strong>No matching bookings</strong>
              <span>Try adjusting your search or filters.</span>
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>

        <div className="pagination">
          <span>
            Showing {visible.length} of {rows.length} booking
            {rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </Panel>

      {/* ── Detail drawer ──────────────────────────────────────────────── */}
      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <StatusBadge status={selected.status} />
          <div className="drawer-title">{selected.eventName}</div>
          <p>
            {selected.id.slice(0, 8)} · Created {formatDate(selected.createdAt)}
          </p>

          <div className="detail-grid">
            <div>
              <span>Customer</span>
              <strong>{selected.customerName ?? selected.customerEmail}</strong>
            </div>
            <div>
              <span>Event date</span>
              <strong>{formatDate(selected.eventDate)}</strong>
            </div>
            <div>
              <span>Guest count</span>
              <strong>{selected.guestCount}</strong>
            </div>
            <div>
              <span>Coordinator</span>
              <strong>{selected.coordinator}</strong>
            </div>
            {selected.specialNotes && (
              <div className="full">
                <span>Notes</span>
                <strong>{selected.specialNotes}</strong>
              </div>
            )}
          </div>

          <div className="booking-status-editor">
            <label>
              <span>Update booking status</span>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(toBookingStatus(e.target.value))}
                aria-label="Booking status"
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            {statusError && <ErrorMessage text={statusError} />}
            <Button
              onClick={() => void saveStatus()}
              disabled={busy || newStatus === selected.status}
            >
              Save status
            </Button>
          </div>

          {drawerActionError && <ErrorMessage text={drawerActionError} />}

          <div className="drawer-actions">
            <Button
              variant="secondary"
              onClick={() => setConfirm(selected)}
              disabled={busy}
            >
              Delete
            </Button>
            <Button onClick={() => openEdit(selected)} disabled={busy}>
              Edit booking
            </Button>
          </div>
        </Drawer>
      )}

      {/* ── Create / Edit dialog ───────────────────────────────────────── */}
      {editing && (
        <BookingFormDialog
          isEditing={!!editing.id}
          form={form}
          errors={errors}
          busy={busy}
          actionError={dialogError}
          onFieldChange={(k, v) => setField(k, v)}
          onSave={() => void save()}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── Delete confirm dialog ──────────────────────────────────────── */}
      {confirm && (
        <Dialog
          onClose={() => setConfirm(null)}
          eyebrow="Confirm deletion"
          title={`Delete "${confirm.eventName}"?`}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={() => void confirmDelete()} disabled={busy}>
                Delete booking
              </Button>
            </>
          }
        >
          <p>
            This will permanently remove the booking for{" "}
            <strong>{confirm.customerName ?? confirm.customerEmail}</strong> on{" "}
            <strong>{formatDate(confirm.eventDate)}</strong>. This action cannot
            be undone.
          </p>
        </Dialog>
      )}

      {notice && <Toast>{notice}</Toast>}
    </div>
  )
}
