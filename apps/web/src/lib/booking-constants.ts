import type { BookingStatus } from "./api"

export const BOOKING_STATUSES: BookingStatus[] = [
  "under_review",
  "quotation_sent",
  "awaiting_confirmation",
  "confirmed",
  "in_preparation",
  "completed",
  "cancelled",
]

export const STATUS_LABELS: Record<BookingStatus, string> = {
  under_review: "Under review",
  quotation_sent: "Quotation sent",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  in_preparation: "In preparation",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const STATUS_TONE: Record<
  BookingStatus,
  "success" | "info" | "warning" | "neutral"
> = {
  under_review: "warning",
  quotation_sent: "info",
  awaiting_confirmation: "warning",
  confirmed: "success",
  in_preparation: "info",
  completed: "success",
  cancelled: "neutral",
}

export const COORDINATORS = ["Unassigned", "Amina Santos", "Jon Bell"]
