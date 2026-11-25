import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";

/** Civil dates for booking lead time follow Philippine business rules. */
const BOOKING_EVENT_TIME_ZONE = "Asia/Manila";

function addCalendarDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function earliestSelectableEventDate(now = new Date()) {
  return addCalendarDays(calendarDateInTimeZone(now, BOOKING_EVENT_TIME_ZONE), 1);
}

export function dateError(
  date: string,
  index: number,
  dates: string[],
  earliest: string,
) {
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    return "Choose a valid date.";

  if (date < earliest) return `Choose ${earliest} or later.`;

  if (dates.indexOf(date) !== index)
    return "Choose a different date for each day.";

  return "";
}
