type ClockPrecision = "minute" | "second";

/** en-CA emits a civil date as YYYY-MM-DD. Time fields use a 00–23 clock. */
export function zonedFormat(timeZone: string, precision?: ClockPrecision) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(precision
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
          hourCycle: "h23" as const,
        }
      : {}),
    ...(precision === "second" ? { second: "2-digit" as const } : {}),
  });
}

export function zonedPartValues(formatter: Intl.DateTimeFormat, instant: Date) {
  return Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
}

export function calendarDateInTimeZone(instant: Date, timeZone: string) {
  const parts = zonedPartValues(zonedFormat(timeZone), instant);
  return `${parts.year}-${parts.month}-${parts.day}`;
}
