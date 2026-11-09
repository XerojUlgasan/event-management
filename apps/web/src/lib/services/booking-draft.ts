import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests"
import type { PublicPackage } from "../data/packages"

const KEY = "clemora-booking-draft"

export type BookingDraftFields = {
  eventType: string
  customEventType: string
  date: string
  estimatedDuration: BookingEstimatedDuration
  estimatedDurationDays: string
  contactName: string
  phoneNumber: string
  specialRequests: string
}

export type BookingDraft = {
  item: PublicPackage
  fields: BookingDraftFields
  timeZone: string
}

export function readBookingDraft(): BookingDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY) || "null")
    return draft && typeof draft.item?.id === "string" && typeof draft.item?.updatedAt === "string" && Number.isInteger(draft.item?.maxGuests) && draft.fields && typeof draft.fields === "object" ? draft as BookingDraft : null
  } catch {
    return null
  }
}

export function clearBookingDraft() {
  sessionStorage.removeItem(KEY)
}

export function saveBookingDraft(draft: BookingDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft))
}
