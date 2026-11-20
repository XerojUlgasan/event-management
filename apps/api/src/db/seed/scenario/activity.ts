import { BOOKING_ESTIMATED_DURATIONS } from "@event-management/contracts/limits/booking-requests";
import type { SeedDb } from "../context.js";
import {
  addUtcDays,
  expectCount,
  insertIfNew,
  manilaInterval,
  SCENARIO_COUNT,
  scenarioId,
  scenarioIndex,
  shuffle,
} from "../context.js";
import type { ScenarioPackage } from "./catalog.js";
import type { ScenarioUser } from "./users.js";

const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Debut",
  "Corporate",
  "Baptism",
  "Anniversary",
  "Conference",
  "Reunion",
] as const;

const DATE_WINDOW_DAYS = 30;

const STATUSES = [
  ...Array<BookingStatus>(25).fill("under_review"),
  ...Array<BookingStatus>(10).fill("needs_details"),
  ...Array<BookingStatus>(50).fill("accepted"),
  ...Array<BookingStatus>(10).fill("declined"),
  ...Array<BookingStatus>(5).fill("cancelled"),
] as const;

type BookingStatus =
  "under_review" | "needs_details" | "accepted" | "declined" | "cancelled";

type DayKind = "scheduled" | "moved" | "cancelled";

export type ScenarioEventDay = {
  id: string;
  bookingId: string;
  day: string;
  startsAt: Date;
  endsAt: Date;
  status: "scheduled" | "cancelled" | "moved";
  replacementEventDayId: string | null;
};

export type ScenarioBooking = {
  id: string;
  reference: string;
  customerId: string;
  packageId: string;
  status: BookingStatus;
  timeZone: string;
  preferredDate: string;
  eventDays: ScenarioEventDay[];
};

/** Inclusive offsets from the seed clock, kept inside the previous and next 30 days. */
function datesInWindow(now: Date, index: number, count: number) {
  const span = DATE_WINDOW_DAYS * 2;
  let start =
    -DATE_WINDOW_DAYS + Math.round((index * span) / (SCENARIO_COUNT - 1));

  if (start + count - 1 > DATE_WINDOW_DAYS)
    start = DATE_WINDOW_DAYS - (count - 1);

  if (start < -DATE_WINDOW_DAYS) start = -DATE_WINDOW_DAYS;

  return Array.from({ length: count }, (_, day) =>
    addUtcDays(now, start + day),
  );
}

type PlannedActivity = {
  bookings: ScenarioBooking[];
  requestedDays: Map<string, string | null>;
};

function patternFor(position: number): DayKind[] {
  const patterns: DayKind[][] = [
    ["scheduled", "scheduled"],
    ["scheduled", "scheduled", "scheduled"],
    ["moved", "scheduled"],
    ["cancelled", "scheduled", "scheduled"],
    ["scheduled", "scheduled"],
  ];
  const pattern = patterns[position % 5];

  if (!pattern) throw new Error("Missing event-day pattern");

  const days = [...pattern];

  if (position % 5 === 0 && position < 20) days.push("scheduled");

  return days;
}

/** Same rule as createBookingRequestService: a known guest count above the package maximum. */
export function bookingOutOfRange(
  guestCount: number | null,
  maxGuests: number,
) {
  return guestCount != null && guestCount > maxGuests;
}

function dayRecord(
  bookingId: string,
  bookingIndex: number,
  dayIndex: number,
  kind: DayKind,
  day: string,
): ScenarioEventDay {
  const interval = manilaInterval(day);

  return {
    id: scenarioId(`event-day:${bookingIndex}:${dayIndex}`),
    bookingId,
    day: interval.day,
    startsAt: interval.startsAt,
    endsAt: interval.endsAt,
    status: kind,
    replacementEventDayId: null,
  };
}

export function planScenarioActivity(input: {
  users: ScenarioUser[];
  packages: ScenarioPackage[];
  now: Date;
  random: () => number;
}): PlannedActivity {
  const customers = input.users.filter((user) => user.role === "customer");

  const availablePackages = input.packages.filter((pkg) => !pkg.archived);

  if (customers.length < 2 || availablePackages.length === 0) {
    throw new Error(
      "Scenario activity requires customers and a published package",
    );
  }

  const statuses = shuffle(STATUSES, input.random);

  const drafts = statuses.map((status, index) => ({
    index,
    status,
    id: scenarioId(`booking:${index}`),
  }));

  const scheduled = drafts
    .filter((booking) => booking.status === "accepted")
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 40);

  const scheduledIds = new Set(scheduled.map((booking) => booking.id));

  const bookings: ScenarioBooking[] = [];
  const requestedDays = new Map<string, string | null>();

  for (const draft of drafts) {
    const customer = customers[draft.index % customers.length];
    const pkg = availablePackages[draft.index % availablePackages.length];

    if (!customer || !pkg)
      throw new Error("Scenario booking is missing a customer or package");

    const eventDays: ScenarioEventDay[] = [];
    let requested: string | null = null;

    if (scheduledIds.has(draft.id)) {
      const position = scheduled.findIndex(
        (booking) => booking.id === draft.id,
      );

      const specs = patternFor(position);
      const dates = datesInWindow(input.now, draft.index, specs.length);
      specs.forEach((spec, dayIndex) => {
        const day = dates[dayIndex];

        if (!day) throw new Error("Scenario event day is missing a date");

        eventDays.push(dayRecord(draft.id, draft.index, dayIndex, spec, day));
      });

      const moved = eventDays.find((day) => day.status === "moved");

      if (moved) {
        const replacement = eventDays.find((day) => day.status === "scheduled");

        if (!replacement || replacement.id === moved.id)
          throw new Error(
            `Moved day ${moved.id} needs a replacement on the same booking`,
          );

        moved.replacementEventDayId = replacement.id;
      }

      requested = JSON.stringify(
        eventDays.map((day) => ({
          date: day.day,
          startsAt: day.startsAt.toISOString(),
          endsAt: day.endsAt.toISOString(),
          eventDayId: day.id,
        })),
      );
    } else if (draft.index % 5 !== 0) {
      const dates = datesInWindow(
        input.now,
        draft.index,
        draft.index % 2 === 0 ? 1 : 2,
      );
      requested = JSON.stringify(
        dates.map((date) => ({ date, startsAt: null, endsAt: null })),
      );
    }

    const preferredDate =
      eventDays[0]?.day ??
      (requested
        ? (JSON.parse(requested) as Array<{ date: string }>)[0]?.date
        : undefined) ??
      datesInWindow(input.now, draft.index, 1)[0];

    if (!preferredDate)
      throw new Error("Scenario booking is missing a preferred date");

    requestedDays.set(draft.id, requested);
    const reference = `SCN-${scenarioIndex(draft.index)}`;
    bookings.push({
      id: draft.id,
      reference,
      customerId: customer.id,
      packageId: pkg.id,
      status: draft.status,
      timeZone:
        eventDays.length > 0 || draft.index % 11 !== 0
          ? "Asia/Manila"
          : "Asia/Tokyo",
      preferredDate,
      eventDays,
    });
  }

  const earliest = addUtcDays(input.now, -DATE_WINDOW_DAYS);
  const latest = addUtcDays(input.now, DATE_WINDOW_DAYS);
  const covered = new Set<string>();

  for (const booking of bookings) {
    covered.add(booking.preferredDate);

    for (const day of booking.eventDays) covered.add(day.day);

    const requested = requestedDays.get(booking.id);

    if (requested)
      for (const day of JSON.parse(requested) as Array<{ date: string }>)
        covered.add(day.date);
  }

  if (
    !covered.has(earliest) ||
    !covered.has(latest) ||
    [...covered].some((day) => day < earliest || day > latest)
  ) {
    throw new Error(
      "Scenario booking dates must cover the 30 days before and after the seed clock, and no date outside that window",
    );
  }

  expectCount("bookings", bookings.length);
  expectCount(
    "event days",
    bookings.reduce((sum, booking) => sum + booking.eventDays.length, 0),
  );

  return { bookings, requestedDays };
}

export async function seedScenarioActivity(
  db: SeedDb,
  input: {
    plan: PlannedActivity;
    users: ScenarioUser[];
    packages: ScenarioPackage[];
    now: Date;
  },
) {
  const admins = input.users.filter((user) => user.role === "admin");

  const admin = admins[0];

  if (!admin) throw new Error("Scenario activity requires an administrator");

  const packages = new Map(input.packages.map((pkg) => [pkg.id, pkg]));

  const customers = new Map(input.users.map((user) => [user.id, user]));

  let bookings = 0;
  let history = 0;
  let conversations = 0;
  let messages = 0;

  for (const [index, booking] of input.plan.bookings.entries()) {
    const pkg = packages.get(booking.packageId);
    const customer = customers.get(booking.customerId);

    if (!pkg || !customer)
      throw new Error(
        `Scenario booking ${booking.reference} is missing its customer or package`,
      );

    const guestCount =
      index % 7 === 0
        ? null
        : index % 7 === 1
          ? pkg.maxGuests + 25
          : Math.max(1, pkg.maxGuests - 10);
    const legacy = booking.eventDays.length === 0 && index % 5 === 0;
    const duration = legacy
      ? (BOOKING_ESTIMATED_DURATIONS[
          index % BOOKING_ESTIMATED_DURATIONS.length
        ] ?? "undecided")
      : "undecided";
    const requested = input.plan.requestedDays.get(booking.id);
    const preferredDate = booking.preferredDate;

    if (
      await insertIfNew(db, "booking_requests", {
        id: booking.id,
        reference: booking.reference,
        customer_id: booking.customerId,
        package_id: booking.packageId,
        event_type: EVENT_TYPES[index % EVENT_TYPES.length] ?? "Wedding",
        preferred_date: preferredDate,
        requested_days: requested ?? null,
        estimated_duration: duration,
        estimated_duration_days: duration === "more_than_1_week" ? 10 : null,
        starts_at: null,
        ends_at: null,
        time_zone: booking.timeZone,
        guest_count: guestCount,
        contact_name: customer.displayName,
        phone_number: `0917${String(index).padStart(7, "0")}`,
        preferred_venue_location: null,
        special_requests:
          index % 3 === 0
            ? null
            : `Please keep the setup simple for ${booking.reference}.`,
        status: booking.status,
        out_of_range: bookingOutOfRange(guestCount, pkg.maxGuests),
        created_at: input.now,
        updated_at: input.now,
      })
    )
      bookings += 1;

    const customerChange =
      booking.status === "under_review" || booking.status === "cancelled";
    const reason =
      booking.status === "needs_details"
        ? "Please confirm the guest count and start time."
        : booking.status === "declined"
          ? "That date is not available."
          : booking.status === "cancelled"
            ? "The customer cancelled this request."
            : null;

    if (
      await insertIfNew(db, "booking_request_status_history", {
        id: scenarioId(`history:${index}`),
        booking_request_id: booking.id,
        status: booking.status,
        reason,
        changed_by: customerChange ? customer.id : admin.id,
        created_at: input.now,
      })
    )
      history += 1;

    if (
      await insertIfNew(db, "conversations", {
        id: scenarioId(`conversation:${index}`),
        customer_id: customer.id,
        booking_request_id: booking.id,
        created_at: input.now,
        updated_at: new Date(input.now.getTime() - 1000),
      })
    )
      conversations += 1;

    const messageCount = index < 40 ? 1 : index < 60 ? 2 : index < 65 ? 4 : 0;

    for (let step = 0; step < messageCount; step += 1) {
      const fromCustomer = step % 2 === 0;

      if (
        await insertIfNew(db, "messages", {
          id: scenarioId(`message:${index}:${step}`),
          conversation_id: scenarioId(`conversation:${index}`),
          sender_id: fromCustomer ? customer.id : admin.id,
          sender_role: fromCustomer ? "customer" : "admin",
          body: fromCustomer
            ? `Hello, I would like to ask about ${booking.reference}.`
            : `Thanks, we are reviewing ${booking.reference}.`,
          created_at: new Date(input.now.getTime() + step * 600_000),
          read_at: step < messageCount - 1 ? input.now : null,
        })
      )
        messages += 1;
    }
  }

  expectCount("status history", input.plan.bookings.length);
  expectCount("booking conversations", input.plan.bookings.length);

  return {
    bookings: input.plan.bookings,
    inserted: { bookings, history, conversations, messages },
  };
}
