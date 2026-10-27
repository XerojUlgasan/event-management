import { useCallback, useState } from "react"
import type { Booking, BookingStatus } from "./api"
import { message } from "./form-utils"

// ── BookingForm type ────────────────────────────────────────────────────────

export type BookingForm = {
  customerId: string
  eventName: string
  eventDate: string
  guestCount: string
  specialNotes: string
  coordinator: string
}

export const emptyForm: BookingForm = {
  customerId: "",
  eventName: "",
  eventDate: "",
  guestCount: "50",
  specialNotes: "",
  coordinator: "Unassigned",
}

// ── Form helpers ────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Convert a Booking API response into a form-ready object.
 *  Strips the time component so the value works with <input type="date">. */
export function formFrom(b: Booking): BookingForm {
  return {
    customerId: b.customerId,
    eventName: b.eventName,
    eventDate: b.eventDate.slice(0, 10), // "2026-11-11T00:00:00.000Z" → "2026-11-11"
    guestCount: String(b.guestCount),
    specialNotes: b.specialNotes ?? "",
    coordinator: b.coordinator,
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
  if (!form.customerId.trim()) {
    errs.customerId = "Customer ID is required."
  } else if (!UUID_RE.test(form.customerId.trim())) {
    errs.customerId = "Must be a valid UUID (e.g. from the Customers page)."
  }
  if (!form.eventName.trim()) errs.eventName = "Event name is required."
  if (!form.eventDate) errs.eventDate = "Event date is required."
  const guests = Number(form.guestCount)
  if (!Number.isInteger(guests) || guests < 1)
    errs.guestCount = "Guest count must be a positive whole number."
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
