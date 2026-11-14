import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";

export const durationLabels: Record<BookingEstimatedDuration, string> = {
  "4_hours": "About 4 hours",
  "8_hours": "About 8 hours",
  "12_hours": "About 12 hours",
  "1_day": "1 day",
  "2_days": "2 days",
  "3_days": "3 days",
  "4_days": "4 days",
  "5_days": "5 days",
  "6_days": "6 days",
  "1_week": "1 week",
  more_than_1_week: "More than 1 week",
  undecided: "Not sure yet",
};
export function durationLabel(
  duration: BookingEstimatedDuration | null,
  days: number | null,
) {
  return duration === "more_than_1_week" && days != null
    ? `${durationLabels[duration]} (${days} days)`
    : duration
      ? durationLabels[duration]
      : "To be confirmed";
}
