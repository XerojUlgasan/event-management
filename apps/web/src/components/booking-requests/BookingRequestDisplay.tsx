import { Badge } from "@event-management/ui";
import type { EventCompletion } from "@event-management/contracts/booking-requests";
import {
  formatEnPhDate,
  formatEnPhDateTime,
} from "../../lib/utils/formatting/dates";
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
    return formatEnPhDateTime(new Date(value), timeZone);
  } catch {
    return "To be confirmed";
  }
}

export function bookingDate(value: string | null) {
  if (!value) return "To be confirmed";

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime())
    ? "To be confirmed"
    : formatEnPhDate(date, "UTC");
}

export function bookingRequestLabel(
  eventType: string | null,
  date: string | null,
) {
  const name = eventType?.trim() || "Event inquiry";

  return date ? `${name} · ${bookingDate(date)}` : name;
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

export function EventCompletionBadge({
  status,
}: {
  status: EventCompletion["status"];
}) {
  return (
    <Badge tone={status === "finished" ? "success" : "info"}>
      {status === "finished" ? "Finished" : "Ready to finish"}
    </Badge>
  );
}
