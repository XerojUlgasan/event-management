import { Badge } from "@event-management/ui";
import type { BookingStatus } from "../../lib/data/booking-requests/requests";

export const bookingStatusLabels: Record<BookingStatus, string> = {
  under_review: "Under review",
  needs_details: "Needs details",
  accepted: "Accepted for processing",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function bookingDateTime(value: string | null, timeZone: string) {
  if (!value) return "To be confirmed";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  } catch {
    return "To be confirmed";
  }
}

export function bookingDate(value: string | null) {
  if (!value) return "To be confirmed";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "To be confirmed"
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge
      tone={
        status === "accepted"
          ? "success"
          : status === "declined" || status === "cancelled"
            ? "danger"
            : "warning"
      }
    >
      {bookingStatusLabels[status]}
    </Badge>
  );
}
