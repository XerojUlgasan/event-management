import { useCallback, useState, useEffect, useRef } from "react"
import type { Booking, BookingService, BookingStatus } from "./api"
import { message } from "./form-utils"

// ── Time helpers (whole-hour, 12-hour display) ──────────────────────────────

/** Whole-hour options from 00:00 to 23:00, as 24-hour HH:mm values. */
export const TIME_OPTIONS: string[] = Array.from(
  { length: 24 },
  (_, hour) => `${String(hour).padStart(2, "0")}:00`,
)

/** Convert 24-hour HH:mm to a 12-hour display string with AM/PM. */
export function formatTime12h(hhmm: string): string {
  if (!hhmm) return ""
  const [hourStr, minuteStr] = hhmm.split(":")
  let hour = Number(hourStr)
  const period = hour >= 12 ? "PM" : "AM"
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${minuteStr} ${period}`
}

/** Add hours to a 24-hour HH:mm value, wrapping at midnight. */
export function addHoursMod24(hhmm: string, hours: number): string {
  if (!hhmm) return ""
  const [hourStr] = hhmm.split(":")
  const newHour = (Number(hourStr) + hours) % 24
  return `${String(newHour).padStart(2, "0")}:00`
}

/** Default end time: start time + 4 hours (wrapping at midnight). */
export function defaultEndTime(start: string): string {
  return start ? addHoursMod24(start, 4) : ""
}

/**
 * Compute the event duration in minutes, handling midnight-crossing
 * (when end < start the event continues into the next day).
 */
export function durationMinutes(start: string, end: string): number {
  const [sH] = start.split(":").map(Number)
  const [eH] = end.split(":").map(Number)
  const s = sH * 60
  const e = eH * 60
  return e > s ? e - s : 24 * 60 - s + e
}

// ── Booking service form type ────────────────────────────────────────────────

export type BookingServiceForm = {
  category: string
  supplierId: string | null
  assignmentStatus: "pending" | "confirmed" | "cancelled"
  notes: string
}

export function emptyService(): BookingServiceForm {
  return {
    category: "Photo Booth",
    supplierId: null,
    assignmentStatus: "pending",
    notes: "",
  }
}

// ── BookingForm type ────────────────────────────────────────────────────────

export type BookingForm = {
  customerId: string
  customerDisplayName: string // For UI display only, not sent to API
  eventName: string
  eventDate: string
  eventStartTime: string // HH:mm
  eventEndTime: string // HH:mm
  eventType: string
  venueName: string
  guestCount: string
  specialNotes: string
  coordinator: string
  services: BookingServiceForm[]
}

export const emptyForm: BookingForm = {
  customerId: "",
  customerDisplayName: "",
  eventName: "",
  eventDate: "",
  eventStartTime: "09:00",
  eventEndTime: "13:00",
  eventType: "wedding",
  venueName: "",
  guestCount: "50",
  specialNotes: "",
  coordinator: "Unassigned",
  services: [],
}

// ── Form helpers ────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Convert a Booking API response into a form-ready object.
 *  Strips the time component so the value works with <input type="date">. */
export function formFrom(b: Booking): BookingForm {
  return {
    customerId: b.customerId,
    customerDisplayName: b.customerName ?? b.customerEmail,
    eventName: b.eventName,
    eventDate: b.eventDate.slice(0, 10), // "2026-11-11T00:00:00.000Z" → "2026-11-11"
    eventStartTime: b.eventStartTime ?? "09:00",
    eventEndTime: b.eventEndTime ?? "13:00",
    eventType: b.eventType ?? "wedding",
    venueName: b.venueName ?? "",
    guestCount: String(b.guestCount),
    specialNotes: b.specialNotes ?? "",
    coordinator: b.coordinator,
    services: (b.services ?? []).map((s: BookingService) => ({
      category: s.category,
      supplierId: s.supplierId,
      assignmentStatus:
        s.assignmentStatus === "confirmed"
          ? "confirmed"
          : s.assignmentStatus === "cancelled"
            ? "cancelled"
            : "pending",
      notes: s.notes ?? "",
    })),
  }
}

/** Restore the time component so the value satisfies z.string().datetime(). */
export function toISODateTime(date: string): string {
  return date ? `${date}T00:00:00.000Z` : date
}

/**
 * Validate a BookingForm and return a map of field → error message.
 * An empty map means the form is valid.
 */
export function validate(form: BookingForm): Record<string, string> {
  const errs: Record<string, string> = {}

  // Customer validation
  if (!form.customerId.trim()) errs.customerId = "Customer is required."
  else if (!UUID_RE.test(form.customerId.trim())) {
    errs.customerId = "Must be a valid customer ID."
  }

  // Event name
  if (!form.eventName.trim()) errs.eventName = "Event name is required."

  // Event date
  if (!form.eventDate) errs.eventDate = "Event date is required."

  // Event type
  if (!form.eventType) errs.eventType = "Event type is required."
  else if (!["wedding", "birthday", "corporate", "debut", "other"].includes(form.eventType)) {
    errs.eventType = "Invalid event type."
  }

  // Venue name
  if (!form.venueName.trim()) errs.venueName = "Venue name is required."

  // Time validation
  const timeErrs = validateTimeRange(form.eventStartTime, form.eventEndTime)
  Object.assign(errs, timeErrs)

  // Date + time validation
  const dateTimeErrs = validateEventDateTime(form.eventDate, form.eventStartTime, form.eventEndTime)
  Object.assign(errs, dateTimeErrs)

  // Guest count
  const guests = Number(form.guestCount)
  if (!Number.isInteger(guests) || guests < 1)
    errs.guestCount = "Guest count must be a positive whole number."

  return errs
}

/**
 * Validate time range: both times required, end must differ from start
 * (allowing midnight crossing), and duration must be at least 4 hours.
 */
export function validateTimeRange(startTime: string, endTime: string): Record<string, string> {
  const errs: Record<string, string> = {}

  if (!startTime) errs.eventStartTime = "Start time is required."
  if (!endTime) errs.eventEndTime = "End time is required."

  if (startTime && endTime) {
    if (startTime === endTime) {
      errs.eventEndTime = "End time must differ from start time."
    } else {
      const duration = durationMinutes(startTime, endTime)
      if (duration < 240) {
        errs.eventEndTime = "Event must be at least 4 hours long."
      }
    }
  }

  return errs
}

/**
 * Validate event date and time are in the future.
 */
export function validateEventDateTime(
  eventDate: string,
  startTime: string,
  _endTime: string,
): Record<string, string> {
  const errs: Record<string, string> = {}

  if (eventDate && startTime) {
    try {
      const eventDateTime = new Date(`${eventDate}T${startTime}:00`)
      const now = new Date()

      if (eventDateTime <= now) {
        errs.eventDate = "Event must be in the future."
      }
    } catch {
      // If date/time parsing fails, let other validators catch it
    }
  }

  return errs
}

/** Format an ISO date string for display. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
}

// ── Tab filter ──────────────────────────────────────────────────────────────

const TAB_FILTERS: Record<string, (b: Booking) => boolean> = {
  all: () => true,
  action: (b) =>
    b.status === "under_review" || b.status === "awaiting_confirmation",
  upcoming: (b) =>
    b.status === "confirmed" || b.status === "in_preparation",
  completed: (b) => b.status === "completed",
  cancelled: (b) => b.status === "cancelled",
}

/** Return the filter predicate for a given tab value. */
export function getTabFilter(tab: string): (b: Booking) => boolean {
  return TAB_FILTERS[tab] ?? (() => true)
}

// ── Mutation hook ───────────────────────────────────────────────────────────

/**
 * Thin wrapper around async API calls.
 * Manages a shared `busy` flag and surfaces errors via thrown Error.
 *
 * Usage:
 *   const { busy, mutate } = useBookingMutation()
 *   await mutate(
 *     () => deleteBooking(id),
 *     () => { setRows(prev => prev.filter(r => r.id !== id)); showNotice("Deleted.") },
 *     (err) => message(err),   // optional custom error formatter
 *   )
 */
export function useBookingMutation() {
  const [busy, setBusy] = useState(false)

  const mutate = useCallback(
    async (
      apiCall: () => Promise<unknown>,
      onSuccess: () => void | Promise<void>,
      formatError?: (err: unknown) => string,
    ): Promise<void> => {
      setBusy(true)
      try {
        await apiCall()
        await onSuccess()
      } catch (err) {
        throw new Error(formatError ? formatError(err) : message(err))
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  return { busy, mutate }
}

// ── Status option helpers ───────────────────────────────────────────────────

/** Narrow an unknown string to BookingStatus, falling back to a default. */
export function toBookingStatus(
  value: string,
  fallback: BookingStatus = "under_review",
): BookingStatus {
  const valid: BookingStatus[] = [
    "under_review",
    "quotation_sent",
    "awaiting_confirmation",
    "confirmed",
    "in_preparation",
    "completed",
    "cancelled",
  ]
  return valid.includes(value as BookingStatus)
    ? (value as BookingStatus)
    : fallback
}

// ── Customer search hook ────────────────────────────────────────────────────

export type Customer = {
  id: string
  displayName: string | null
  email: string
}

/**
 * Hook to search customers by name or email.
 * Debounces 300 ms. Requires at least 2 characters.
 */
export function useCustomerSearch(query: string) {
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!query.trim() || query.length < 2) {
      setResults([])
      setError("")
      return
    }

    setLoading(true)
    setError("")

    timeoutRef.current = setTimeout(async () => {
      try {
        const apiUrl =
          (import.meta as { env?: { PUBLIC_API_URL?: string } }).env
            ?.PUBLIC_API_URL ?? "http://localhost:3000/v1"
        const response = await fetch(
          `${apiUrl}/admin/customers?search=${encodeURIComponent(query)}`,
          { credentials: "include" },
        )
        if (!response.ok) throw new Error("Failed to search customers")
        const data = (await response.json()) as { customers: Customer[] }
        setResults(data.customers)
      } catch (err) {
        setError(message(err))
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [query])

  return { results, loading, error }
}
