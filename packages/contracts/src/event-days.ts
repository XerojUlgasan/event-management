export const RESPONSE_DEADLINE_DAYS = [1, 2, 3, 4] as const;
export type ResponseDeadlineDays = (typeof RESPONSE_DEADLINE_DAYS)[number];

/** End of the calculated local calendar date, independent of the event's clock time. */
export function responseDeadlineForDay(
  day: string,
  daysBefore: ResponseDeadlineDays,
  timeZone: string,
): string {
  if (!RESPONSE_DEADLINE_DAYS.includes(daysBefore))
    throw new Error("Choose 1, 2, 3, or 4 days before the event date");
  const date = new Date(`${day}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== day
  )
    throw new Error("Invalid event date");
  date.setUTCDate(date.getUTCDate() - daysBefore);
  const targetDate = date.toISOString().slice(0, 10);
  const wall = Date.parse(`${targetDate}T23:59:59.999Z`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const local = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (name: string) =>
      parts.find((part) => part.type === name)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
  };
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 3_600_000;
    offsets.add(
      Date.parse(`${local(sample)}Z`) - Math.floor(sample / 1000) * 1000,
    );
  }
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((instant) => local(instant) === `${targetDate}T23:59:59`);
  if (!candidates.length)
    throw new Error(
      `The response deadline date ${targetDate} does not have a valid local end time in ${timeZone}`,
    );
  // If a timezone repeats the final clock time, the later occurrence ends that date.
  return new Date(Math.max(...candidates)).toISOString();
}
export type EventDayStaffRow = {
  staffId: string;
  staffName: string;
  eligible: boolean;
  assignment: {
    role: "coordinator" | "helper";
    status: "confirmed" | "cancelled";
  } | null;
};
