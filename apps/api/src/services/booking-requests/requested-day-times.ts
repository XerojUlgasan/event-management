import type { RequestedDay } from "../../controllers/booking-requests/schemas.js";

function localParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const value = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, clock: `${value("hour")}:${value("minute")}:${value("second")}` };
}

// A valid instant can still describe a repeated local clock time. Find the timezone's
// offsets around the transition and reject a wall time with more than one instant.
function isAmbiguous(instant: Date, timeZone: string) {
  const local = localParts(instant, timeZone);
  const wall = Date.parse(`${local.date}T${local.clock}Z`);
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = new Date(instant.getTime() + hours * 3_600_000);
    const parts = localParts(sample, timeZone);
    offsets.add(Date.parse(`${parts.date}T${parts.clock}Z`) - Math.floor(sample.getTime() / 1000) * 1000);
  }
  let matches = 0;
  for (const offset of offsets) {
    const candidate = localParts(new Date(wall - offset), timeZone);
    if (candidate.date === local.date && candidate.clock === local.clock) matches++;
  }
  return matches > 1;
}

export function requestedDayTimesError(date: string, startsAt: string, endsAt: string, timeZone: string) {
  const start = new Date(startsAt), end = new Date(endsAt);
  if (!(end > start)) return "End must be after start";
  const startLocal = localParts(start, timeZone), endLocal = localParts(end, timeZone);
  if (startLocal.date !== date) return "Start must match the requested date in the booking time zone";
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  if (endLocal.date !== date && endLocal.date !== nextDate) return "End must be on the requested date or the following day";
  if (isAmbiguous(start, timeZone) || isAmbiguous(end, timeZone)) return "Choose an unambiguous local time outside the daylight-saving transition";
  return null;
}

export function withSavedTimes(day: RequestedDay, startsAt: string, endsAt: string): RequestedDay {
  return { ...day, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() };
}
