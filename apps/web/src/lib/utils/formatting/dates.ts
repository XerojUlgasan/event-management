export function formatEnPh(
  value: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("en-PH", options).format(value);
}

export function formatEnPhDate(value: Date, timeZone?: string) {
  return formatEnPh(value, {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatEnPhDateTime(value: Date, timeZone?: string) {
  return formatEnPh(value, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  });
}

export const enPhDayFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const enPhTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});
