import type { BookingRequest } from "../../data/booking-requests/requests";
import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";

// A delayed time-save response must not undo a newer cancellation or edit.
export function latestCustomerEvent(
  current: BookingRequest,
  updated: BookingRequest,
) {
  return current.updatedAt > updated.updatedAt ||
    (current.eventCompletion?.status === "finished" &&
      updated.eventCompletion?.status !== "finished") ||
    (["declined", "cancelled"].includes(current.status) &&
      current.status !== updated.status)
    ? current
    : updated;
}

export const customerEventGroups = [
  { key: "today", label: "Today", description: "Requests with a date today." },
  {
    key: "upcoming",
    label: "Upcoming",
    description: "Your next requested dates, soonest first.",
  },
  {
    key: "undated",
    label: "Dates to arrange",
    description: "Requests without a preferred date yet.",
  },
  {
    key: "past",
    label: "Past dates",
    description: "Previous requested dates, most recent first.",
  },
  {
    key: "finished",
    label: "Finished events",
    description: "Dates show when the team marked each event finished.",
  },
  {
    key: "closed",
    label: "Closed requests",
    description: "Cancelled and declined requests.",
  },
] as const;

type CustomerEventGroup = (typeof customerEventGroups)[number]["key"];

// Requested dates stay separate from operational schedules, which can move.
export function customerEventPosition(item: BookingRequest, now = new Date()) {
  if (item.eventCompletion?.status === "finished")
    return {
      group: "finished" as const,
      date: calendarDateInTimeZone(
        new Date(item.eventCompletion.finishedAt),
        item.timeZone,
      ),
      dayCount: 0,
    };

  const today = calendarDateInTimeZone(now, item.timeZone);

  const dates = (
    item.requestedDays?.map((day) => day.date) ??
    (item.preferredDate ? [item.preferredDate] : [])
  ).toSorted();

  const nextDate = dates.find((date) => date >= today);

  const date = nextDate ?? dates.at(-1) ?? null;
  const group: CustomerEventGroup =
    item.status === "declined" || item.status === "cancelled"
      ? "closed"
      : !date
        ? "undated"
        : date === today
          ? "today"
          : date > today
            ? "upcoming"
            : "past";

  return { group, date, dayCount: dates.length };
}

export function groupCustomerEvents(items: BookingRequest[], now = new Date()) {
  const positioned = items.map((item) => ({
    item,
    ...customerEventPosition(item, now),
  }));

  return customerEventGroups.map((group) => ({
    ...group,
    events: positioned
      .filter((event) => event.group === group.key)
      .sort((a, b) => {
        if (group.key === "closed" || group.key === "undated")
          return b.item.createdAt.localeCompare(a.item.createdAt);

        const order = (a.date ?? "").localeCompare(b.date ?? "");

        return (
          (group.key === "past" || group.key === "finished" ? -order : order) ||
          b.item.createdAt.localeCompare(a.item.createdAt)
        );
      }),
  }));
}
