import {
  zonedFormat,
  zonedPartValues,
} from "@event-management/contracts/calendar-date";

// Interpret wall-clock values in the booking zone, never in the administrator's browser zone.
export function zonedInstant(value: string, zone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a complete date and time.");
  const desired = Date.UTC(
    +match[1],
    +match[2] - 1,
    +match[3],
    +match[4],
    +match[5],
  );
  const normalized = new Date(desired);
  if (
    +match[1] < 100 ||
    normalized.getUTCFullYear() !== +match[1] ||
    normalized.getUTCMonth() !== +match[2] - 1 ||
    normalized.getUTCDate() !== +match[3] ||
    normalized.getUTCHours() !== +match[4] ||
    normalized.getUTCMinutes() !== +match[5]
  ) {
    throw new Error("Enter a valid date and time.");
  }
  const formatter = zonedFormat(zone, "minute");
  let instant = desired;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    const observed = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
    );
    if (observed === desired) {
      // Reject repeated local times at daylight-saving transitions instead of
      // silently choosing one of the two possible instants.
      const target = formatter.format(new Date(instant));
      for (let minutes = -180; minutes <= 180; minutes += 15) {
        if (
          minutes !== 0 &&
          formatter.format(new Date(instant + minutes * 60_000)) === target
        ) {
          throw new Error(
            `That local time occurs twice in ${zone}. Choose an unambiguous time.`,
          );
        }
      }
      return new Date(instant).toISOString();
    }
    instant += desired - observed;
  }
  throw new Error(
    `That local time does not exist in ${zone}. Choose another time.`,
  );
}
export function localInput(value: string | null, zone: string) {
  if (!value) return "";
  const formatter = zonedFormat(zone, "minute");
  const parts = zonedPartValues(formatter, new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
