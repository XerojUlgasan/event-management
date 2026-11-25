import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";
import { MIN_ADVANCE_BOOKING_DAYS } from "@event-management/contracts/limits/booking-requests";

export function todayInZone(zone: string) {
  return calendarDateInTimeZone(new Date(), zone);
}

export function minBookingDateInZone(zone: string) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + MIN_ADVANCE_BOOKING_DAYS);
  return calendarDateInTimeZone(d, zone);
}

export function dateError(
  date: string,
  index: number,
  dates: string[],
  zone: string,
) {
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    return "Choose a valid date.";

  if (date < minBookingDateInZone(zone))
    return `Choose a date at least ${MIN_ADVANCE_BOOKING_DAYS} days from today.`;

  if (dates.indexOf(date) !== index)
    return "Choose a different date for each day.";

  return "";
}
