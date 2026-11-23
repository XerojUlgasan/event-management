import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";

export function todayInZone(zone: string) {
  return calendarDateInTimeZone(new Date(), zone);
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
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
    date < todayInZone(zone)
  )
    return "Choose a valid date today or in the future.";

  if (dates.indexOf(date) !== index)
    return "Choose a different date for each day.";

  return "";
}
