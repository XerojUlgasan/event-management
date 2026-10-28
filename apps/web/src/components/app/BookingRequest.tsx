import { useEffect, useId, useRef, useState, type SubmitEvent } from "react"
import { createPortal } from "react-dom"
import { ApiError, createBookingRequest, getMe, type PublicPackage } from "../../lib/api"

const KEY = "clemora-booking-draft"
type Fields = { eventType: string; date: string; start: string; endDate: string; end: string; guestCount: string; contactName: string; phoneNumber: string; preferredVenueLocation: string; specialRequests: string }
type Draft = { item: PublicPackage; fields: Fields; timeZone: string }
type Errors = Partial<Record<keyof Fields, string>>
export function readBookingDraft(): Draft | null { try { return JSON.parse(sessionStorage.getItem(KEY) || "null") as Draft | null } catch { return null } }
export function clearBookingDraft() { sessionStorage.removeItem(KEY) }
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }
function localInstant(date: string, time: string) {
  if (!date || !time) return null
  const value = new Date(`${date}T${time}`)
  // Reject nonexistent local times during a daylight-saving transition.
  if (!Number.isFinite(value.getTime()) || localDate(value) !== date || `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}` !== time) return null
  return value
}
function validate(fields: Fields): Errors {
  const errors: Errors = {}, start = localInstant(fields.date, fields.start), end = localInstant(fields.endDate, fields.end)
  if (!fields.eventType) errors.eventType = "Choose an event type."
  if (!fields.date || fields.date < localDate(new Date())) errors.date = "Choose today or a future date."
  if (!start || start <= new Date()) errors.start = "Choose a valid future start time."
  if (!fields.endDate) errors.endDate = "Choose an estimated end date."
  if (!end || (start && end <= start)) errors.end = "Choose an end date and time after the start."
  const count = Number(fields.guestCount)
  if (!fields.guestCount || !Number.isInteger(count) || count < 1 || count > 2147483647) errors.guestCount = "Enter a valid number of guests."
  if (!fields.contactName.trim()) errors.contactName = "Enter a contact person."
  if (!fields.phoneNumber.trim()) errors.phoneNumber = "Enter a phone number."
  if (!fields.preferredVenueLocation.trim()) errors.preferredVenueLocation = "Enter a preferred venue or location."
  return errors
}
export function BookingRequestDialog({ item, resume = false, onClose }: { item: PublicPackage; resume?: boolean; onClose: () => void }) {
  const saved = resume ? readBookingDraft() : null
  const [fields, setFields] = useState<Fields>(saved?.fields ? { ...saved.fields, endDate: saved.fields.endDate || saved.fields.date } : { eventType: item.eventTypes[0] || "", date: "", start: "", endDate: "", end: "", guestCount: "", contactName: "", phoneNumber: "", preferredVenueLocation: "", specialRequests: "" })
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [review, setReview] = useState(resume && saved?.timeZone === timeZone)
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [auth, setAuth] = useState<"loading" | "customer" | "signed-out" | "admin" | "error">("loading")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(resume && saved?.timeZone !== timeZone ? "Your time zone changed. Please check your event times before continuing." : "")
  const [reference, setReference] = useState("")
  const dialog = useRef<HTMLDialogElement>(null), summary = useRef<HTMLDivElement>(null)
  const titleId = useId(), prefix = useId()
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => { dialog.current?.close(); trigger?.focus() } }, [])
  useEffect(() => { if (!review) return; let active = true; setAuth("loading"); getMe().then(profile => { if (active) setAuth(profile.role === "customer" ? "customer" : "admin") }).catch(cause => { if (active) setAuth(cause instanceof ApiError && cause.status === 401 ? "signed-out" : "error") }); return () => { active = false } }, [review])
  const errors = validate(fields)
  const change = (key: keyof Fields, value: string) => setFields(current => ({ ...current, [key]: value, ...(key === "date" && (!current.endDate || current.endDate === current.date) ? { endDate: value } : {}) }))
  const cancel = () => { clearBookingDraft(); onClose() }
  const next = (event: SubmitEvent<HTMLFormElement>) => { event.preventDefault(); const found = validate(fields); if (Object.keys(found).length) { setTouched(Object.fromEntries(Object.keys(found).map(key => [key, true]))); requestAnimationFrame(() => summary.current?.focus()); return }; setError(""); setReview(true) }
  const signIn = () => { sessionStorage.setItem(KEY, JSON.stringify({ item, fields, timeZone })); window.location.assign("/?booking=resume") }
  const submit = async () => {
    if (Object.keys(validate(fields)).length) { setError("Please check your event details; the start time must still be in the future."); setReview(false); return }
    setBusy(true); setError("")
    try { const result = await createBookingRequest({ packageId: item.id, packageVersionId: item.versionId, eventType: fields.eventType, startsAt: localInstant(fields.date, fields.start)!.toISOString(), endsAt: localInstant(fields.endDate, fields.end)!.toISOString(), timeZone, guestCount: Number(fields.guestCount), contactName: fields.contactName.trim(), phoneNumber: fields.phoneNumber.trim(), preferredVenueLocation: fields.preferredVenueLocation.trim(), specialRequests: fields.specialRequests.trim() }); clearBookingDraft(); setReference(result.bookingRequest.reference) } catch (cause) { if (cause instanceof ApiError && cause.status === 401) setAuth("signed-out"); else setError(cause instanceof Error ? cause.message : "Unable to submit request.") } finally { setBusy(false) }
  }
  const outside = Number(fields.guestCount) > 0 && (Number(fields.guestCount) < item.guestMin || Number(fields.guestCount) > item.guestMax)
  const field = (key: keyof Fields, label: string, control: React.ReactNode) => <label className={key === "specialRequests" || key === "preferredVenueLocation" ? "booking-wide" : undefined} htmlFor={`${prefix}-${key}`}><span>{label}</span>{control}{touched[key] && errors[key] && <small className="booking-field-error" id={`${prefix}-${key}-error`}>{errors[key]}</small>}</label>
  const props = (key: keyof Fields) => ({ id: `${prefix}-${key}`, value: fields[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(key, e.target.value), onBlur: () => setTouched(current => ({ ...current, [key]: true })), "aria-invalid": !!(touched[key] && errors[key]), "aria-describedby": touched[key] && errors[key] ? `${prefix}-${key}-error` : undefined })
  return createPortal(<dialog ref={dialog} className="booking-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); event.stopPropagation(); cancel() }}><div className="booking-dialog-body"><button type="button" className="booking-close" onClick={cancel} aria-label="Close booking request">×</button><span className="booking-eyebrow">Clemora / Booking request</span><h2 id={titleId}>{reference ? "Request submitted" : review ? "Review your request" : "Let’s plan your event"}</h2><p className="booking-intro">{item.name}</p>{reference ? <><p>Your request reference is <strong>{reference}</strong>. Staff will review it.</p><button type="button" onClick={cancel}>Close</button></> : review ? <><dl className="booking-review"><div><dt>Event</dt><dd>{fields.eventType} · {fields.guestCount} guests</dd></div><div><dt>Preferred date and time</dt><dd>{fields.date} {fields.start} – {fields.endDate} {fields.end} ({timeZone})</dd></div><div><dt>Contact</dt><dd>{fields.contactName} · {fields.phoneNumber}</dd></div><div><dt>Preferred venue or location</dt><dd>{fields.preferredVenueLocation}</dd></div><div><dt>Special requests</dt><dd>{fields.specialRequests || "None"}</dd></div></dl>{outside && <p className="booking-warning">Your guest count is outside this package’s estimated {item.guestMin}–{item.guestMax} guest range and will need staff review.</p>}<p>Your preferred date is not reserved. Staff will review availability and the final price.</p>{auth === "signed-out" && <p>Sign in to continue. Your details will be saved for this session, and you’ll review them again before submitting.</p>}{auth === "admin" && <p role="alert">Sign in with a customer account to submit a request.</p>}{auth === "error" && <p role="alert">Unable to check your session. Please try again.</p>}{error && <p role="alert">{error}</p>}<div className="booking-actions"><button type="button" onClick={() => setReview(false)}>Edit details</button>{auth === "signed-out" ? <button type="button" onClick={signIn}>Sign in to continue</button> : auth === "error" ? <button type="button" onClick={() => { setReview(false); setError("Please review your details and try again.") }}>Try again</button> : <button type="button" disabled={busy || auth !== "customer"} onClick={() => void submit()}>{busy ? "Submitting…" : auth === "loading" ? "Checking session…" : "Submit request"}</button>}</div></> : <form onSubmit={next} noValidate>{Object.keys(touched).some(key => errors[key as keyof Fields]) && <div className="booking-field-error" ref={summary} tabIndex={-1} role="alert">Please check the highlighted fields below.</div>}<div className="booking-fields">{field("eventType", "Event type", <select {...props("eventType")}><option value="">Select event type</option>{Array.from(new Set([...item.eventTypes, "Wedding", "Birthday", "Anniversary", "Corporate event", "Family gathering", "Other"])).map(type => <option key={type}>{type}</option>)}</select>)}{field("guestCount", "Estimated guests", <input {...props("guestCount")} type="number" min="1" max="2147483647" step="1" />)}{field("date", "Preferred date", <input {...props("date")} type="date" min={localDate(new Date())} />)}{field("start", "Start time", <input {...props("start")} type="time" />)}{field("endDate", "Estimated end date", <input {...props("endDate")} type="date" min={fields.date || localDate(new Date())} />)}{field("end", "Estimated end time", <input {...props("end")} type="time" />)}{field("contactName", "Contact person", <input {...props("contactName")} maxLength={200} />)}{field("phoneNumber", "Phone number", <input {...props("phoneNumber")} type="tel" maxLength={100} />)}{field("preferredVenueLocation", "Preferred venue or location", <input {...props("preferredVenueLocation")} maxLength={1000} />)}{field("specialRequests", "Special requests or services (optional)", <textarea {...props("specialRequests")} maxLength={4000} />)}</div><p>Times use your current time zone: {timeZone}.</p>{outside && <p className="booking-warning">Your guest count is outside this package’s estimated {item.guestMin}–{item.guestMax} guest range and will need staff review.</p>}{error && <p role="alert">{error}</p>}<div className="booking-actions"><button type="button" onClick={cancel}>Cancel</button><button type="submit">Review request</button></div></form>}</div></dialog>, document.body)
}
