import { useCallback, useEffect, useRef, useState } from "react"
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
  getSupplierAvailability,
  listBookings,
  listSuppliers,
  updateBooking,
  updateBookingStatus,
} from "../../../lib/api"
import type { Booking, BookingStatus, Supplier } from "../../../lib/api"
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_STATUS_LABELS,
  BOOKING_STATUSES,
  COORDINATORS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  SERVICE_CATEGORIES,
  STATUS_LABELS,
  STATUS_TONE,
} from "../../../lib/booking-constants"
import {
  TIME_OPTIONS,
  defaultEndTime,
  emptyForm,
  emptyService,
  formatDate,
  formatTime12h,
  formFrom,
  getTabFilter,
  toBookingStatus,
  toISODateTime,
  useBookingMutation,
  useCustomerSearch,
  validate,
} from "../../../lib/booking-utils"
import type { BookingForm, BookingServiceForm } from "../../../lib/booking-utils"
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

function CustomerSelector({
  displayName,
  onChange,
  error,
}: {
  displayName: string
  onChange: (id: string, name: string) => void
  error?: string
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [open, setOpen] = useState(false)
  const { results, loading } = useCustomerSearch(searchQuery)

  return (
    <FormField label="Customer *" className="full">
      <div className="customer-selector">
        <input
          type="text"
          value={searchQuery || displayName}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or email"
          aria-invalid={!!error}
        />
        {open && (searchQuery.length >= 2 || results.length > 0) && (
          <div className="customer-dropdown">
            {loading && <div className="customer-dropdown-msg">Searching...</div>}
            {!loading && results.length === 0 && searchQuery.length >= 2 && (
              <div className="customer-dropdown-msg">No customers found</div>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id, c.displayName || c.email)
                  setSearchQuery("")
                  setOpen(false)
                }}
                className="customer-dropdown-item"
              >
                <strong>{c.displayName || "Unknown"}</strong>
                <span>{c.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <span className="field-error">{error}</span>}
    </FormField>
  )
}

function TimeRangeField({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  errors,
}: {
  startTime: string
  endTime: string
  onStartChange: (t: string) => void
  onEndChange: (t: string) => void
  errors: Record<string, string>
}) {
  return (
    <div className="time-range-inputs">
      <FormField label="Start time *">
        <select
          value={startTime}
          onChange={(e) => onStartChange(e.target.value)}
          aria-invalid={!!errors.eventStartTime}
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTime12h(t)}
            </option>
          ))}
        </select>
        {errors.eventStartTime && (
          <span className="field-error">{errors.eventStartTime}</span>
        )}
      </FormField>
      <FormField label="End time *">
        <select
          value={endTime}
          onChange={(e) => onEndChange(e.target.value)}
          aria-invalid={!!errors.eventEndTime}
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTime12h(t)}
            </option>
          ))}
        </select>
        {errors.eventEndTime && (
          <span className="field-error">{errors.eventEndTime}</span>
        )}
      </FormField>
    </div>
  )
}

// ── Supplier search/selection ─────────────────────────────────────────────────

function SupplierSelect({
  category,
  supplierId,
  onChange,
  eventDate,
  eventStartTime,
  eventEndTime,
}: {
  category: string
  supplierId: string | null
  onChange: (id: string | null) => void
  eventDate: string
  eventStartTime: string
  eventEndTime: string
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [avail, setAvail] = useState<{
    loading: boolean
    available: boolean
    conflict: string | null
  } | null>(null)
  const availTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = suppliers.find((s) => s.id === supplierId) ?? null

  // Fetch suppliers when category changes
  useEffect(() => {
    if (!category) {
      setSuppliers([])
      return
    }
    let cancelled = false
    setLoading(true)
    listSuppliers({ category })
      .then((data) => {
        if (!cancelled) setSuppliers(data.suppliers)
      })
      .catch(() => {
        if (!cancelled) setSuppliers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [category])

  // Check availability when supplier + date/time are set
  useEffect(() => {
    if (availTimer.current) clearTimeout(availTimer.current)
    if (!supplierId || !eventDate || !eventStartTime || !eventEndTime) {
      setAvail(null)
      return
    }
    setAvail({ loading: true, available: false, conflict: null })
    availTimer.current = setTimeout(async () => {
      try {
        const result = await getSupplierAvailability(
          supplierId,
          eventDate,
          eventStartTime,
          eventEndTime,
        )
        setAvail({
          loading: false,
          available: result.available,
          conflict: result.conflictingBookings[0]?.eventName ?? null,
        })
      } catch {
        setAvail(null)
      }
    }, 400)
    return () => {
      if (availTimer.current) clearTimeout(availTimer.current)
    }
  }, [supplierId, eventDate, eventStartTime, eventEndTime])

  const filtered = suppliers.filter((s) =>
    !searchQuery
      ? true
      : `${s.name} ${s.email ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div>
      <div className="supplier-select">
        <input
          type="text"
          value={searchQuery || selected?.name || ""}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={
            suppliers.length === 0 && !loading
              ? "No suppliers in this category"
              : "Search suppliers by name"
          }
          disabled={suppliers.length === 0 && !loading}
        />
        {open && suppliers.length > 0 && (
          <div className="supplier-dropdown">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setSearchQuery("")
                setOpen(false)
              }}
              className={`supplier-dropdown-item ${supplierId === null ? "active" : ""}`}
            >
              <strong>Internal / no external supplier</strong>
            </button>
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id)
                  setSearchQuery("")
                  setOpen(false)
                }}
                className={`supplier-dropdown-item ${s.id === supplierId ? "active" : ""}`}
              >
                <strong>{s.name}</strong>
                <small>
                  {s.contactNumber ?? "No contact"} · {s.email ?? "No email"}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected supplier contact + availability */}
      {selected && (
        <div className="supplier-info">
          <div className="supplier-info-header">
            <strong>{selected.name}</strong>
            {avail && !avail.loading && (
              <span className={`supplier-availability ${avail.available ? "available" : "unavailable"}`}>
                {avail.available ? "Available" : "Unavailable"}
              </span>
            )}
            {avail?.loading && (
              <span className="supplier-availability checking">Checking…</span>
            )}
          </div>
          {selected.contactNumber && (
            <div className="supplier-info-contact">{selected.contactNumber}</div>
          )}
          {selected.email && (
            <div className="supplier-info-contact">{selected.email}</div>
          )}
          {avail && !avail.available && avail.conflict && (
            <div className="supplier-conflict">
              Conflicts with "{avail.conflict}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Services & suppliers section ──────────────────────────────────────────────

function ServicesSection({
  services,
  onChange,
  eventDate,
  eventStartTime,
  eventEndTime,
}: {
  services: BookingServiceForm[]
  onChange: (services: BookingServiceForm[]) => void
  eventDate: string
  eventStartTime: string
  eventEndTime: string
}) {
  const update = (index: number, patch: Partial<BookingServiceForm>) => {
    onChange(
      services.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    )
  }

  const add = () => {
    onChange([...services, emptyService()])
  }

  const remove = (index: number) => {
    onChange(services.filter((_, i) => i !== index))
  }

  return (
    <div>
      {services.length === 0 && (
        <p className="services-hint">No additional services added yet.</p>
      )}

      {services.map((service, index) => (
        <div key={index} className="service-card">
          <div className="service-card-header">
            <strong className="service-card-title">
              Service {index + 1}: {service.category}
            </strong>
            <Button
              variant="secondary"
              onClick={() => remove(index)}
              disabled={false}
            >
              Remove
            </Button>
          </div>

          <div className="service-card-body">
            <FormField label="Category *">
              <select
                value={service.category}
                onChange={(e) => {
                  // Changing category clears the supplier selection
                  update(index, {
                    category: e.target.value,
                    supplierId: null,
                    assignmentStatus: "pending",
                  })
                }}
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Supplier">
              <SupplierSelect
                category={service.category}
                supplierId={service.supplierId}
                onChange={(id) => update(index, { supplierId: id })}
                eventDate={eventDate}
                eventStartTime={eventStartTime}
                eventEndTime={eventEndTime}
              />
            </FormField>

            <FormField label="Assignment status">
              <select
                value={service.assignmentStatus}
                onChange={(e) =>
                  update(index, {
                    assignmentStatus: e.target
                      .value as BookingServiceForm["assignmentStatus"],
                  })
                }
              >
                {ASSIGNMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {ASSIGNMENT_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notes">
              <input
                type="text"
                value={service.notes}
                onChange={(e) => update(index, { notes: e.target.value })}
                placeholder="Equipment specs, special requests"
              />
            </FormField>
          </div>
        </div>
      ))}

      <Button variant="secondary" onClick={add}>
        + Add service
      </Button>
    </div>
  )
}

// ── Wizard Steps ──────────────────────────────────────────────────────────

type WizardStep = "customer" | "event" | "services" | "pricing" | "review"

const WIZARD_STEPS: WizardStep[] = ["customer", "event", "services", "pricing", "review"]
const STEP_LABELS: Record<WizardStep, string> = {
  customer: "Customer",
  event: "Event Details",
  services: "Services",
  pricing: "Pricing",
  review: "Review",
}

function BookingWizard({
  isEditing,
  form,
  errors,
  busy,
  actionError,
  onFieldChange,
  onServicesChange,
  onSave,
  onClose,
}: {
  isEditing: boolean
  form: BookingForm
  errors: Record<string, string>
  busy: boolean
  actionError: string
  onFieldChange: (key: keyof BookingForm, value: string) => void
  onServicesChange: (services: BookingServiceForm[]) => void
  onSave: () => void
  onClose: () => void
}) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("customer")

  const stepIndex = WIZARD_STEPS.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isReviewStep = currentStep === "review"

  const canProgress = () => {
    // For edit mode, skip customer step
    if (isEditing && currentStep === "customer") return true

    // Basic validation per step
    switch (currentStep) {
      case "customer":
        return form.customerId.trim().length > 0
      case "event":
        return (
          form.eventName.trim().length > 0 &&
          form.eventDate.length > 0 &&
          form.venueName.trim().length > 0 &&
          form.guestCount.trim().length > 0
        )
      case "services":
      case "pricing":
      case "review":
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    const nextIndex = stepIndex + 1
    if (nextIndex < WIZARD_STEPS.length) {
      setCurrentStep(WIZARD_STEPS[nextIndex])
    }
  }

  const goBack = () => {
    const prevIndex = stepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(WIZARD_STEPS[prevIndex])
    }
  }

  const jumpToStep = (step: WizardStep) => {
    setCurrentStep(step)
  }

  // Auto-skip customer step when editing
  useEffect(() => {
    if (isEditing && currentStep === "customer") {
      setCurrentStep("event")
    }
  }, [isEditing, currentStep])

  return (
    <Dialog
      onClose={onClose}
      eyebrow="Booking record"
      title={isEditing ? "Edit booking" : "Create booking"}
      actions={
        <div className="wizard-nav">
          <div className="wizard-nav-left">
            {!isFirstStep && !isEditing && (
              <Button variant="secondary" onClick={goBack} disabled={busy}>
                Back
              </Button>
            )}
          </div>
          <div className="wizard-nav-right">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {!isReviewStep && (
              <Button onClick={goNext} disabled={busy || !canProgress()}>
                Next
              </Button>
            )}
            {isReviewStep && (
              <Button onClick={onSave} disabled={busy}>
                {isEditing ? "Save changes" : "Create booking"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Progress indicator */}
      <div className="wizard-progress">
        {WIZARD_STEPS.filter(s => !isEditing || s !== "customer").map((step) => {
          const actualSteps = isEditing ? WIZARD_STEPS.filter(s => s !== "customer") : WIZARD_STEPS
          const actualIndex = actualSteps.indexOf(step)
          const currentIndex = actualSteps.indexOf(currentStep)
          const isComplete = actualIndex < currentIndex
          const isActive = step === currentStep

          return (
            <div key={step} className="wizard-step-indicator">
              <div className={`wizard-step-bar ${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`} />
              <span className={`wizard-step-label ${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`}>
                {STEP_LABELS[step]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="wizard-content">
        {currentStep === "customer" && !isEditing && (
          <CustomerStep
            form={form}
            errors={errors}
            onFieldChange={onFieldChange}
          />
        )}
        {currentStep === "event" && (
          <EventStep
            form={form}
            errors={errors}
            onFieldChange={onFieldChange}
            isEditing={isEditing}
          />
        )}
        {currentStep === "services" && (
          <ServicesStep
            form={form}
            onServicesChange={onServicesChange}
          />
        )}
        {currentStep === "pricing" && (
          <PricingStep />
        )}
        {currentStep === "review" && (
          <ReviewStep
            form={form}
            isEditing={isEditing}
            onEdit={jumpToStep}
          />
        )}
      </div>

      {/* Global errors */}
      {actionError && <ErrorMessage text={actionError} />}
    </Dialog>
  )
}

// ── Step 1: Customer ───────────────────────────────────────────────────────

function CustomerStep({
  form,
  errors,
  onFieldChange,
}: {
  form: BookingForm
  errors: Record<string, string>
  onFieldChange: (key: keyof BookingForm, value: string) => void
}) {
  return (
    <div className="form-grid">
      <CustomerSelector
        displayName={form.customerDisplayName}
        onChange={(id, name) => {
          onFieldChange("customerId", id)
          onFieldChange("customerDisplayName", name)
        }}
        error={errors.customerId}
      />
    </div>
  )
}

// ── Step 2: Event Details ──────────────────────────────────────────────────

function EventStep({
  form,
  errors,
  onFieldChange,
  isEditing,
}: {
  form: BookingForm
  errors: Record<string, string>
  onFieldChange: (key: keyof BookingForm, value: string) => void
  isEditing: boolean
}) {
  return (
    <div className="form-grid">
      {isEditing && form.customerDisplayName && (
        <FormField label="Customer" className="full">
          <input
            type="text"
            value={form.customerDisplayName}
            disabled
            style={{ background: "#f5f5f5", cursor: "not-allowed" }}
          />
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

      <FormField label="Event type *">
        <select
          value={form.eventType}
          onChange={(e) => onFieldChange("eventType", e.target.value)}
          aria-invalid={!!errors.eventType}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {errors.eventType && (
          <span className="field-error">{errors.eventType}</span>
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

      <div className="full">
        <TimeRangeField
          startTime={form.eventStartTime}
          endTime={form.eventEndTime}
          onStartChange={(t) => {
            onFieldChange("eventStartTime", t)
            onFieldChange("eventEndTime", defaultEndTime(t))
          }}
          onEndChange={(t) => onFieldChange("eventEndTime", t)}
          errors={errors}
        />
      </div>

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

      <FormField label="Venue name *">
        <input
          type="text"
          value={form.venueName}
          onChange={(e) => onFieldChange("venueName", e.target.value)}
          placeholder="e.g. Grand Ballroom, Manila"
          aria-invalid={!!errors.venueName}
        />
        {errors.venueName && (
          <span className="field-error">{errors.venueName}</span>
        )}
      </FormField>

      <FormField label="Coordinator" className="full">
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
          placeholder="Any special requirements or requests"
          rows={3}
        />
      </FormField>
    </div>
  )
}

// ── Step 3: Services ───────────────────────────────────────────────────────

function ServicesStep({
  form,
  onServicesChange,
}: {
  form: BookingForm
  onServicesChange: (services: BookingServiceForm[]) => void
}) {
  return (
    <div>
      <p className="services-hint">
        Add additional services and assign a supplier to each. Leave the
        supplier as "Internal" for services provided in-house.
      </p>
      <ServicesSection
        services={form.services}
        onChange={onServicesChange}
        eventDate={form.eventDate}
        eventStartTime={form.eventStartTime}
        eventEndTime={form.eventEndTime}
      />
    </div>
  )
}

// ── Step 4: Pricing ────────────────────────────────────────────────────────

function PricingStep() {
  return (
    <div className="form-grid">
      <div className="full">
        <p className="services-hint">
          Package selection and pricing details will be available in the booking drawer after creation.
        </p>
      </div>
    </div>
  )
}

// ── Step 5: Review ─────────────────────────────────────────────────────────

function ReviewStep({
  form,
  isEditing,
  onEdit,
}: {
  form: BookingForm
  isEditing: boolean
  onEdit: (step: WizardStep) => void
}) {
  return (
    <div>
      {/* Customer */}
      {!isEditing && (
        <div className="review-section">
          <div className="review-section-title">Customer Information</div>
          <div className="review-grid">
            <div className="review-item full">
              <span className="review-label">Customer</span>
              <span className="review-value">
                {form.customerDisplayName || <span className="review-empty">Not selected</span>}
              </span>
            </div>
          </div>
          <div className="review-actions">
            <button
              type="button"
              onClick={() => onEdit("customer")}
              className="review-edit-button"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Event Details */}
      <div className="review-section">
        <div className="review-section-title">Event Details</div>
        <div className="review-grid">
          <div className="review-item full">
            <span className="review-label">Event name</span>
            <span className="review-value">
              {form.eventName || <span className="review-empty">Not provided</span>}
            </span>
          </div>
          <div className="review-item">
            <span className="review-label">Event type</span>
            <span className="review-value">{EVENT_TYPE_LABELS[form.eventType]}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Event date</span>
            <span className="review-value">
              {form.eventDate ? formatDate(form.eventDate) : <span className="review-empty">Not set</span>}
            </span>
          </div>
          <div className="review-item">
            <span className="review-label">Start time</span>
            <span className="review-value">{formatTime12h(form.eventStartTime)}</span>
          </div>
          <div className="review-item">
            <span className="review-label">End time</span>
            <span className="review-value">{formatTime12h(form.eventEndTime)}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Guest count</span>
            <span className="review-value">{form.guestCount || <span className="review-empty">Not set</span>}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Venue</span>
            <span className="review-value">
              {form.venueName || <span className="review-empty">Not provided</span>}
            </span>
          </div>
          <div className="review-item">
            <span className="review-label">Coordinator</span>
            <span className="review-value">{form.coordinator}</span>
          </div>
          {form.specialNotes && (
            <div className="review-item full">
              <span className="review-label">Special notes</span>
              <span className="review-value">{form.specialNotes}</span>
            </div>
          )}
        </div>
        <div className="review-actions">
          <button
            type="button"
            onClick={() => onEdit("event")}
            className="review-edit-button"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="review-section">
        <div className="review-section-title">Services & Suppliers</div>
        {form.services.length === 0 ? (
          <p className="services-hint">No additional services added.</p>
        ) : (
          <div className="review-services-list">
            {form.services.map((service, idx) => (
              <div key={idx} className="review-service">
                <div className="review-service-header">
                  <span className="review-service-category">{service.category}</span>
                  <span className="review-service-status">
                    {ASSIGNMENT_STATUS_LABELS[service.assignmentStatus]}
                  </span>
                </div>
                <div className="review-service-details">
                  Supplier: {service.supplierId ? "External" : "Internal"}
                  {service.notes && ` • ${service.notes}`}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="review-actions">
          <button
            type="button"
            onClick={() => onEdit("services")}
            className="review-edit-button"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Pricing */}
      <div className="review-section">
        <div className="review-section-title">Pricing & Package</div>
        <p className="services-hint">
          Package and pricing details will be set in the booking drawer after {isEditing ? "saving" : "creation"}.
        </p>
      </div>
    </div>
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

  // Load bookings
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

  // Derived state
  const tabFilter = getTabFilter(activeTab)
  const visible = rows.filter((b) => {
    const search = query.toLowerCase().trim()
    const matchSearch =
      !search ||
      `${b.eventName} ${b.customerName ?? ""} ${b.customerEmail} ${b.id} ${b.venueName}`
        .toLowerCase()
        .includes(search)
    const matchStatus = !filterStatus || b.status === filterStatus
    const matchCoord = !filterCoordinator || b.coordinator === filterCoordinator
    return tabFilter(b) && matchSearch && matchStatus && matchCoord
  })

  const countFor = (tab: string) => rows.filter(getTabFilter(tab)).length

  // Helpers
  const showNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(""), 2500)
  }

  const clearFilters = () => {
    setQuery("")
    setFilterStatus("")
    setFilterCoordinator("")
  }

  // Drawer
  const openDrawer = (b: Booking) => {
    setSelected(b)
    setNewStatus(b.status)
    setStatusError("")
    setDrawerActionError("")
  }

  // Status update
  const saveStatus = async () => {
    if (!selected) return
    setStatusError("")
    try {
      await mutate(
        () => updateBookingStatus(selected.id, newStatus),
        async () => {
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

  // Create/Edit
  const openCreate = () => {
    reset()
    setErrors({})
    setDialogError("")
    setEditing({ id: null })
  }

  const openEdit = (b: Booking) => {
    const f = formFrom(b)
    // Set all fields except services (which is an array)
    Object.entries(f).forEach(([k, v]) => {
      if (k !== "services") {
        setField(k as keyof BookingForm, v as string)
      }
    })
    // Set services separately
    setField("services", f.services)
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
              eventStartTime: form.eventStartTime,
              eventEndTime: form.eventEndTime,
              eventType: form.eventType,
              venueName: form.venueName.trim(),
              guestCount: Number(form.guestCount),
              specialNotes: form.specialNotes.trim() || null,
              coordinator: form.coordinator,
              services: form.services.map((s) => ({
                category: s.category,
                supplierId: s.supplierId,
                assignmentStatus: s.assignmentStatus,
                notes: s.notes.trim() || undefined,
              })),
            }),
          () => {
            void load()
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
              eventStartTime: form.eventStartTime,
              eventEndTime: form.eventEndTime,
              eventType: form.eventType,
              venueName: form.venueName.trim(),
              guestCount: Number(form.guestCount),
              specialNotes: form.specialNotes.trim() || undefined,
              coordinator: form.coordinator,
              services: form.services.map((s) => ({
                category: s.category,
                supplierId: s.supplierId,
                assignmentStatus: s.assignmentStatus,
                notes: s.notes.trim() || undefined,
              })),
            }),
          () => {
            void load()
            showNotice("Booking created.")
            setEditing(null)
          },
        )
      }
    } catch (err) {
      setDialogError(message(err))
    }
  }

  // Delete
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

  // Render
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
            placeholder="Search event, customer, or venue"
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
            <span>Time</span>
            <span>Guests</span>
            <span>Venue</span>
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
                  <small>{b.customerName ?? b.customerEmail}</small>
                </span>
                <span>
                  <strong>{formatDate(b.eventDate)}</strong>
                </span>
                <span>
                  <small>
                    {b.eventStartTime} – {b.eventEndTime}
                  </small>
                </span>
                <span>{b.guestCount}</span>
                <span>
                  <small>{b.venueName}</small>
                </span>
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

      {/* Detail drawer */}
      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <StatusBadge status={selected.status} />
          <div className="drawer-title">{selected.eventName}</div>
          <p>
            {selected.id.slice(0, 8)} · {EVENT_TYPE_LABELS[selected.eventType]} ·{" "}
            {formatDate(selected.createdAt)}
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
              <span>Time</span>
              <strong>
                {selected.eventStartTime} – {selected.eventEndTime}
              </strong>
            </div>
            <div>
              <span>Venue</span>
              <strong>{selected.venueName}</strong>
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

      {/* Create / Edit wizard */}
      {editing && (
        <BookingWizard
          isEditing={!!editing.id}
          form={form}
          errors={errors}
          busy={busy}
          actionError={dialogError}
          onFieldChange={(k, v) => setField(k, v)}
          onServicesChange={(services) => setField("services", services)}
          onSave={() => void save()}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Delete confirm dialog */}
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
            <strong>{formatDate(confirm.eventDate)}</strong> at{" "}
            <strong>{confirm.eventStartTime}</strong>. This action cannot be
            undone.
          </p>
        </Dialog>
      )}

      {notice && <Toast>{notice}</Toast>}
    </div>
  )
}
