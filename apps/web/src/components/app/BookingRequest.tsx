import { MAX_EVENT_TYPE_LENGTH, MAX_CONTACT_NAME_LENGTH, MAX_PHONE_NUMBER_LENGTH, MAX_SPECIAL_REQUESTS_LENGTH, type BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests"
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react"
import { createPortal } from "react-dom"
import { ApiError, createBookingRequest, getMe, type PublicPackage } from "../../lib/api"

const KEY = "clemora-booking-draft"
const OTHER = "__other__"
const COMMON_EVENT_TYPES = ["Birthday", "Wedding", "Corporate"] as const
const NEW_DURATION_OPTIONS: BookingEstimatedDuration[] = ["1_day", "2_days", "3_days", "4_days", "5_days", "6_days", "1_week", "more_than_1_week", "undecided"]
export const durationLabels: Record<BookingEstimatedDuration, string> = { "4_hours": "About 4 hours", "8_hours": "About 8 hours", "12_hours": "About 12 hours", "1_day": "1 day", "2_days": "2 days", "3_days": "3 days", "4_days": "4 days", "5_days": "5 days", "6_days": "6 days", "1_week": "1 week", "more_than_1_week": "More than 1 week", undecided: "Not sure yet" }
export function durationLabel(duration: BookingEstimatedDuration | null, days: number | null) { return duration === "more_than_1_week" && days != null ? `${durationLabels[duration]} (${days} days)` : duration ? durationLabels[duration] : "To be confirmed" }
type Fields = { eventType: string; customEventType: string; date: string; estimatedDuration: BookingEstimatedDuration; estimatedDurationDays: string; contactName: string; phoneNumber: string; specialRequests: string }
type Draft = { item: PublicPackage; fields: Fields; timeZone: string }
type Errors = Partial<Record<keyof Fields, string>>
export function readBookingDraft(): Draft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY) || "null")
    return draft && typeof draft.item?.id === "string" && typeof draft.item?.updatedAt === "string" && Array.isArray(draft.item?.eventTypes) && draft.fields && typeof draft.fields === "object" ? draft as Draft : null
  } catch { return null }
}
export function clearBookingDraft() { sessionStorage.removeItem(KEY) }
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }
function eventOptions(item: PublicPackage) {
  const seen = new Set<string>()
  return [...item.eventTypes.filter(Boolean), ...COMMON_EVENT_TYPES].filter(type => {
    const key = type.toLocaleLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
function validate(fields: Fields, requireName = true): Errors {
  const errors: Errors = {}
  const eventType = fields.eventType === OTHER ? fields.customEventType.trim() : fields.eventType.trim()
  if (!fields.eventType) errors.eventType = "Choose an event type."
  else if (!eventType) errors.customEventType = "Enter your event type."
  else if (eventType.length > MAX_EVENT_TYPE_LENGTH) errors[fields.eventType === OTHER ? "customEventType" : "eventType"] = `Use ${MAX_EVENT_TYPE_LENGTH} characters or fewer.`
  if (!fields.date || fields.date < localDate(new Date())) errors.date = "Choose today or a future date."
  if (fields.estimatedDuration === "more_than_1_week") {
    const days = Number(fields.estimatedDurationDays)
    if (!fields.estimatedDurationDays || !Number.isInteger(days) || days < 8 || days > 2147483647) errors.estimatedDurationDays = "Enter an exact number of days, at least 8."
  }
  if (requireName && !fields.contactName.trim()) errors.contactName = "Enter a contact person."
  if (!fields.phoneNumber.trim()) errors.phoneNumber = "Enter a phone number."
  for (const [key, limit] of [["contactName", MAX_CONTACT_NAME_LENGTH], ["phoneNumber", MAX_PHONE_NUMBER_LENGTH], ["specialRequests", MAX_SPECIAL_REQUESTS_LENGTH]] as const) if (fields[key].trim().length > limit) errors[key] = `Use ${limit} characters or fewer.`
  return errors
}
export function BookingRequestDialog({ item, resume = false, onClose }: { item: PublicPackage; resume?: boolean; onClose: () => void }) {
  const saved = resume ? readBookingDraft() : null
  const [fields, setFields] = useState<Fields>(() => {
    const old = saved?.fields
    const oldType = typeof old?.eventType === "string" ? old.eventType : ""
    const options = eventOptions(item)
    const custom = oldType === OTHER || oldType === "Other" || (!!oldType && !options.includes(oldType))
    return { eventType: oldType ? (custom ? OTHER : oldType) : "", customEventType: custom ? (oldType === OTHER ? (typeof old?.customEventType === "string" ? old.customEventType : "") : oldType === "Other" ? "" : oldType) : "", date: typeof old?.date === "string" ? old.date : "", estimatedDuration: old?.estimatedDuration && NEW_DURATION_OPTIONS.includes(old.estimatedDuration) ? old.estimatedDuration : "undecided", estimatedDurationDays: typeof old?.estimatedDurationDays === "string" ? old.estimatedDurationDays : "", contactName: typeof old?.contactName === "string" ? old.contactName : "", phoneNumber: typeof old?.phoneNumber === "string" ? old.phoneNumber : "", specialRequests: typeof old?.specialRequests === "string" ? old.specialRequests : "" }
  })
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [review, setReview] = useState(!!saved)
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [auth, setAuth] = useState<"loading" | "customer" | "signed-out" | "admin" | "error">("loading")
  const [busy, setBusy] = useState(false)
  const [noteOpen, setNoteOpen] = useState(() => !!fields.specialRequests)
  const [error, setError] = useState(saved && saved.timeZone !== timeZone ? "Your time zone changed. Please check your preferred date before submitting." : "")
  const [reference, setReference] = useState("")
  const dialog = useRef<HTMLDialogElement>(null), summary = useRef<HTMLDivElement>(null), nameEdited = useRef(false)
  const currentFields = useRef(fields)
  currentFields.current = fields
  const titleId = useId(), prefix = useId()
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => { dialog.current?.close(); trigger?.focus() } }, [])
  const checkAuth = () => { setAuth("loading"); getMe().then(profile => {
    setAuth(profile.role === "customer" ? "customer" : "admin")
    const name = currentFields.current.contactName.trim() || (!nameEdited.current ? profile.displayName?.trim() : "") || ""
    if (name && !currentFields.current.contactName.trim()) setFields(current => ({ ...current, contactName: name }))
    if (profile.role === "customer" && !name && resume) { setReview(false); setError("Please add a contact person before submitting your request."); requestAnimationFrame(() => document.getElementById(`${prefix}-contactName`)?.focus()) }
  }).catch(cause => setAuth(cause instanceof ApiError && cause.status === 401 ? "signed-out" : "error")) }
  useEffect(() => { checkAuth() }, [])
  const errors = validate(fields, auth === "customer")
  const change = (key: keyof Fields, value: string) => { if (key === "contactName") nameEdited.current = true; setFields(current => ({ ...current, [key]: value })) }
  const cancel = () => { clearBookingDraft(); onClose() }
  const submit = async () => {
    const found = validate(fields)
    if (Object.keys(found).length) { setTouched(Object.fromEntries(Object.keys(found).map(key => [key, true]))); setReview(false); requestAnimationFrame(() => summary.current?.focus()); return }
    setBusy(true); setError("")
    try { const result = await createBookingRequest({ packageId: item.id, packageUpdatedAt: item.updatedAt, eventType: (fields.eventType === OTHER ? fields.customEventType : fields.eventType).trim(), preferredDate: fields.date, estimatedDuration: fields.estimatedDuration, ...(fields.estimatedDuration === "more_than_1_week" ? { estimatedDurationDays: Number(fields.estimatedDurationDays) } : {}), timeZone, contactName: fields.contactName.trim(), phoneNumber: fields.phoneNumber.trim(), ...(fields.specialRequests.trim() ? { specialRequests: fields.specialRequests.trim() } : {}) }); clearBookingDraft(); setReference(result.bookingRequest.reference) } catch (cause) { if (cause instanceof ApiError && cause.status === 401) { setAuth("signed-out"); setReview(false); setError("Your session ended. Sign in to continue.") } else setError(cause instanceof Error ? cause.message : "Unable to submit request.") } finally { setBusy(false) }
  }
  const next = (event: SubmitEvent<HTMLFormElement>) => { event.preventDefault(); const found = validate(fields, auth === "customer"); if (Object.keys(found).length) { setTouched(Object.fromEntries(Object.keys(found).map(key => [key, true]))); requestAnimationFrame(() => summary.current?.focus()); return }; if (auth === "signed-out") { sessionStorage.setItem(KEY, JSON.stringify({ item, fields, timeZone })); window.location.assign("/?booking=resume") } else if (auth === "customer") void submit() }
  const field = (key: keyof Fields, label: string, control: React.ReactNode) => <label className={key === "specialRequests" || key === "customEventType" ? "booking-wide" : undefined} htmlFor={`${prefix}-${key}`}><span>{label}</span>{control}{touched[key] && errors[key] && <small className="booking-field-error" id={`${prefix}-${key}-error`}>{errors[key]}</small>}</label>
  const props = (key: keyof Fields) => ({ id: `${prefix}-${key}`, value: fields[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(key, e.target.value), onBlur: () => setTouched(current => ({ ...current, [key]: true })), "aria-invalid": !!(touched[key] && errors[key]), "aria-describedby": touched[key] && errors[key] ? `${prefix}-${key}-error` : undefined })
  return createPortal(<dialog ref={dialog} className="booking-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); event.stopPropagation(); cancel() }}><div className="booking-dialog-body"><button type="button" className="booking-close" onClick={cancel} aria-label="Close booking request">×</button><span className="booking-eyebrow">Clemora / Booking request</span><h2 id={titleId}>{reference ? "Request submitted" : review ? "Review your request" : "Let’s plan your event"}</h2><p className="booking-intro">{item.name}</p>{reference ? <><p>Your request reference is <strong>{reference}</strong>. Staff will review it.</p><button type="button" onClick={cancel}>Close</button></> : review ? <><dl className="booking-review"><div><dt>Event</dt><dd>{fields.eventType === OTHER ? fields.customEventType : fields.eventType}</dd></div><div><dt>Preferred date</dt><dd>{fields.date}</dd></div><div><dt>Estimated event length</dt><dd>{durationLabel(fields.estimatedDuration, fields.estimatedDuration === "more_than_1_week" ? Number(fields.estimatedDurationDays) : null)}</dd></div><div><dt>Contact</dt><dd>{fields.contactName} · {fields.phoneNumber}</dd></div><div><dt>Special requests</dt><dd>{fields.specialRequests || "None"}</dd></div></dl><p>Your preferred date is not reserved. Staff will review availability and the final price.</p>{error && <p role="alert">{error}</p>}{auth === "admin" && <p role="alert">Sign in with a customer account to submit a request.</p>}{auth === "error" && <p role="alert">Unable to check your session. <button type="button" onClick={checkAuth}>Try again</button></p>}<div className="booking-actions"><button type="button" onClick={() => setReview(false)}>Edit details</button><button type="button" disabled={busy || auth !== "customer"} onClick={() => void submit()}>{busy ? "Submitting…" : auth === "loading" ? "Checking session…" : "Submit request"}</button></div></> : <form onSubmit={next} noValidate>{Object.keys(touched).some(key => errors[key as keyof Fields]) && <div className="booking-field-error" ref={summary} tabIndex={-1} role="alert">Please check the highlighted fields below.</div>}<div className="booking-fields">{field("eventType", "Event type", <select {...props("eventType")}><option value="">Select event type</option>{eventOptions(item).map(type => <option key={type} value={type}>{type}</option>)}<option value={OTHER}>Not on the list</option></select>)}{fields.eventType === OTHER && field("customEventType", "Your event type", <input {...props("customEventType")} maxLength={MAX_EVENT_TYPE_LENGTH} />)}{field("date", "Preferred date", <input {...props("date")} type="date" min={localDate(new Date())} />)}{field("estimatedDuration", "Estimated event length", <select {...props("estimatedDuration")}>{NEW_DURATION_OPTIONS.map(value => <option key={value} value={value}>{durationLabels[value]}</option>)}</select>)}{fields.estimatedDuration === "more_than_1_week" && field("estimatedDurationDays", "Exact number of days", <input {...props("estimatedDurationDays")} type="number" min="8" max="2147483647" step="1" inputMode="numeric" />)}<div className="booking-contact-row">{field("phoneNumber", "Phone number", <input {...props("phoneNumber")} type="tel" maxLength={MAX_PHONE_NUMBER_LENGTH} />)}{field("contactName", "Contact person", <input {...props("contactName")} maxLength={MAX_CONTACT_NAME_LENGTH} />)}</div></div><details className="booking-note" open={noteOpen} onToggle={event => setNoteOpen(event.currentTarget.open)}><summary>Add a note (optional)</summary>{field("specialRequests", "Special requests or services", <textarea {...props("specialRequests")} maxLength={MAX_SPECIAL_REQUESTS_LENGTH} />)}</details><p>For multiple event days, the preferred date is the first day. Event length is an estimate.</p><p>Your preferred date is not reserved. Staff will review availability and the final price.</p>{auth === "signed-out" && <p>Sign in to continue. Your details will be saved for this session, and you’ll review them before submitting.</p>}{auth === "admin" && <p role="alert">Sign in with a customer account to submit a request.</p>}{auth === "error" && <p role="alert">Unable to check your session. <button type="button" onClick={checkAuth}>Try again</button></p>}{error && <p role="alert">{error}</p>}<div className="booking-actions"><button type="button" onClick={cancel}>Cancel</button><button type="submit" disabled={busy || auth === "loading" || auth === "admin" || auth === "error"}>{busy ? "Submitting…" : auth === "loading" ? "Checking session…" : auth === "signed-out" ? "Sign in to continue" : "Submit request"}</button></div></form>}</div></dialog>, document.body)
}
