import assert from "node:assert/strict";
import test from "node:test";
import type { BookingRequest } from "../../src/lib/data/booking-requests/requests";
import {
  customerEventPosition,
  groupCustomerEvents,
  latestCustomerEvent,
} from "../../src/lib/services/booking-requests/customer-event-timeline";

const now = new Date("2026-11-14T12:00:00.000Z");

function makeRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: "request-fixture",
    reference: "REQ-FIXTURE-001",
    customerId: "fixture-customer-id",
    packageId: "fixture-package-id",
    eventType: "Birthday",
    durationMode: "one_day",
    requestedDays: [
      {
        date: "2026-11-15",
        startsAt: null,
        endsAt: null,
        operationalSchedule: null,
      },
    ],
    timeZone: "Asia/Manila",
    contactName: "",
    phoneNumber: "",
    preferredDate: "2026-11-15",
    estimatedDuration: null,
    estimatedDurationDays: null,
    requestedDayCount: 1,
    guestCount: null,
    startsAt: null,
    endsAt: null,
    preferredVenueLocation: null,
    specialRequests: null,
    requestedServices: [],
    budget: null,
    packageName: "Sample package",
    packagePrice: { kind: "fixed", currency: "PHP", amountMinor: 0 },
    packageMaxGuests: 1,
    status: "under_review",
    eventCompletion: null,
    outOfRange: false,
    submittedAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

function requestedDay(
  date: string,
): NonNullable<BookingRequest["requestedDays"]>[number] {
  return {
    date,
    startsAt: null,
    endsAt: null,
    operationalSchedule: null,
  };
}

function eventIds(
  group: ReturnType<typeof groupCustomerEvents>[number] | undefined,
) {
  return group?.events.map(({ item }) => item.id);
}

test("uses the request timezone to decide whether a requested date is today", () => {
  const item = makeRequest({
    requestedDays: [requestedDay("2026-11-14")],
    preferredDate: "2026-11-14",
  });

  assert.deepEqual(
    customerEventPosition(item, new Date("2026-11-13T16:30:00.000Z")),
    {
      group: "today",
      date: "2026-11-14",
      dayCount: 1,
    },
  );
});

test("a nonconsecutive requested-date gap does not make the request a today event", () => {
  const item = makeRequest({
    requestedDays: [requestedDay("2026-11-13"), requestedDay("2026-11-15")],
    preferredDate: "2026-11-13",
  });

  assert.deepEqual(customerEventPosition(item, now), {
    group: "upcoming",
    date: "2026-11-15",
    dayCount: 2,
  });
});

test("multi-date requests use their nearest future requested date", () => {
  const item = makeRequest({
    requestedDays: [
      requestedDay("2026-11-18"),
      requestedDay("2026-11-15"),
      requestedDay("2026-11-16"),
    ],
    preferredDate: "2026-11-15",
  });

  assert.deepEqual(customerEventPosition(item, now), {
    group: "upcoming",
    date: "2026-11-15",
    dayCount: 3,
  });
});

test("declined and cancelled requests stay in the closed group regardless of date", () => {
  for (const status of ["declined", "cancelled"] as const) {
    const item = makeRequest({ status });
    assert.equal(customerEventPosition(item, now).group, "closed");
  }
});

test("legacy requests use preferredDate, while requests without either date are undated", () => {
  const legacy = makeRequest({
    requestedDays: null,
    preferredDate: "2026-11-16",
  });
  const undated = makeRequest({ requestedDays: null, preferredDate: null });

  assert.deepEqual(customerEventPosition(legacy, now), {
    group: "upcoming",
    date: "2026-11-16",
    dayCount: 1,
  });
  assert.deepEqual(customerEventPosition(undated, now), {
    group: "undated",
    date: null,
    dayCount: 0,
  });
});

test("upcoming dates sort ascending and past dates sort descending", () => {
  const groups = groupCustomerEvents(
    [
      makeRequest({
        id: "upcoming-later",
        requestedDays: [requestedDay("2026-11-18")],
      }),
      makeRequest({
        id: "past-earlier",
        requestedDays: [requestedDay("2026-11-09")],
      }),
      makeRequest({
        id: "upcoming-first",
        requestedDays: [requestedDay("2026-11-15")],
      }),
      makeRequest({
        id: "past-later",
        requestedDays: [requestedDay("2026-11-13")],
      }),
      makeRequest({
        id: "upcoming-middle",
        requestedDays: [requestedDay("2026-11-16")],
      }),
      makeRequest({
        id: "past-middle",
        requestedDays: [requestedDay("2026-11-11")],
      }),
    ],
    now,
  );

  assert.deepEqual(eventIds(groups.find(({ key }) => key === "upcoming")), [
    "upcoming-first",
    "upcoming-middle",
    "upcoming-later",
  ]);
  assert.deepEqual(eventIds(groups.find(({ key }) => key === "past")), [
    "past-later",
    "past-middle",
    "past-earlier",
  ]);
});

test("a moved operational schedule does not change requested-date grouping", () => {
  const item = makeRequest({
    status: "accepted",
    requestedDays: [
      {
        ...requestedDay("2026-11-13"),
        eventDayId: "fixture-event-day",
        operationalSchedule: {
          id: "fixture-event-day",
          day: "2026-11-20",
          startsAt: "2026-11-20T09:00:00.000Z",
          endsAt: "2026-11-20T17:00:00.000Z",
          timeZone: "Asia/Manila",
          status: "scheduled",
        },
      },
    ],
    preferredDate: "2026-11-13",
  });

  assert.deepEqual(customerEventPosition(item, now), {
    group: "past",
    date: "2026-11-13",
    dayCount: 1,
  });
});

test("a finished event with a cancelled future day uses its confirmation date", () => {
  const item = makeRequest({
    status: "accepted",
    requestedDays: [
      requestedDay("2026-11-13"),
      {
        ...requestedDay("2026-11-15"),
        eventDayId: "cancelled-day-id",
        operationalSchedule: {
          id: "cancelled-day-id",
          day: "2026-11-15",
          startsAt: "2026-11-15T09:00:00.000Z",
          endsAt: "2026-11-15T17:00:00.000Z",
          timeZone: "Asia/Manila",
          status: "cancelled",
        },
      },
    ],
    eventCompletion: {
      status: "finished",
      finishedAt: "2026-11-13T16:01:00.000Z",
    },
  });

  const groups = groupCustomerEvents([item], now);
  assert.deepEqual(eventIds(groups.find(({ key }) => key === "upcoming")), []);
  assert.deepEqual(eventIds(groups.find(({ key }) => key === "today")), []);
  assert.deepEqual(groups.find(({ key }) => key === "finished")?.events, [
    { item, group: "finished", date: "2026-11-14", dayCount: 0 },
  ]);
});

test("an older time-save response cannot replace a cancellation, including an equal revision", () => {
  const cancelled = makeRequest({
    status: "cancelled",
    updatedAt: "2026-11-14T12:00:00.000Z",
  });

  for (const updatedAt of [
    "2026-11-14T11:59:59.000Z",
    "2026-11-14T12:00:00.000Z",
  ]) {
    const timeSave = makeRequest({
      status: "under_review",
      updatedAt,
      requestedDays: [
        {
          ...requestedDay("2026-11-15"),
          startsAt: "2026-11-15T09:00:00.000Z",
          endsAt: "2026-11-15T17:00:00.000Z",
        },
      ],
    });

    assert.strictEqual(latestCustomerEvent(cancelled, timeSave), cancelled);
  }
});

test("an older ordinary edit cannot replace the current request", () => {
  const current = makeRequest({
    updatedAt: "2026-11-14T12:00:00.000Z",
    requestedDays: [
      {
        ...requestedDay("2026-11-15"),
        startsAt: "2026-11-15T10:00:00.000Z",
        endsAt: "2026-11-15T18:00:00.000Z",
      },
    ],
  });
  const olderEdit = makeRequest({
    updatedAt: "2026-11-14T11:59:59.000Z",
    requestedDays: [requestedDay("2026-11-16")],
  });

  assert.strictEqual(latestCustomerEvent(current, olderEdit), current);
});

test("a newer valid time save replaces the current request", () => {
  const current = makeRequest({ updatedAt: "2026-11-14T12:00:00.000Z" });
  const saved = makeRequest({
    updatedAt: "2026-11-14T12:00:01.000Z",
    requestedDays: [
      {
        ...requestedDay("2026-11-15"),
        startsAt: "2026-11-15T09:00:00.000Z",
        endsAt: "2026-11-15T17:00:00.000Z",
      },
    ],
  });

  assert.strictEqual(latestCustomerEvent(current, saved), saved);
});
