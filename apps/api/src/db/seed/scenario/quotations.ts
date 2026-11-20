import type {
  QuotationItem,
  QuotationStatus,
} from "@event-management/contracts/quotations";
import { resolveBookingPackageData } from "../../../data/booking-requests/resolve-booking-package.js";
import {
  amount,
  basePrice,
} from "../../../services/quotations/quotation-context.js";
import type { SeedDb } from "../context.js";
import {
  expectCount,
  insertIfNew,
  SCENARIO_COUNT,
  scenarioId,
} from "../context.js";
import type { ScenarioBooking } from "./activity.js";
import type { ScenarioUser } from "./users.js";

const quoteId = (bookingId: string, version: number) =>
  scenarioId(`quotation:${bookingId}:${version}`);

export async function seedScenarioQuotations(
  db: SeedDb,
  input: { bookings: ScenarioBooking[]; users: ScenarioUser[]; now: Date },
) {
  const admin = await db
    .selectFrom("users")
    .select("id")
    .where(
      "id",
      "in",
      input.users.map((user) => user.id),
    )
    .where("role", "=", "admin")
    .orderBy("id")
    .executeTakeFirst();

  if (!admin)
    throw new Error("Scenario quotations require a System Administrator");

  // Read stored parents: earlier seed attempts may have used another status shuffle.
  const parents = await db
    .selectFrom("booking_requests as b")
    .innerJoin("users as customer", "customer.id", "b.customer_id")
    .innerJoin("conversations as c", "c.booking_request_id", "b.id")
    .select([
      "b.id",
      "b.package_id",
      "b.customer_id",
      "b.status",
      "c.id as conversation_id",
    ])
    .where(
      "b.id",
      "in",
      input.bookings.map((booking) => booking.id),
    )
    .where("customer.role", "=", "customer")
    .orderBy("b.id")
    .execute();

  const existing = await db
    .selectFrom("quotations")
    .select(["id", "booking_request_id"])
    .where(
      "booking_request_id",
      "in",
      input.bookings.map((booking) => booking.id),
    )
    .execute();

  const seededBookings = new Set(
    existing
      .filter(
        (row) =>
          row.id === quoteId(row.booking_request_id, 1) ||
          row.id === quoteId(row.booking_request_id, 2),
      )
      .map((row) => row.booking_request_id),
  );

  const occupiedBookings = new Set(
    existing.map((row) => row.booking_request_id),
  );

  const eligible = parents.filter(
    (booking) =>
      seededBookings.has(booking.id) ||
      (!occupiedBookings.has(booking.id) &&
        !["declined", "cancelled"].includes(booking.status)),
  );

  // Keep previously selected parents even when a user later closes their request.
  const selected = eligible
    .sort(
      (a, b) =>
        Number(seededBookings.has(b.id)) - Number(seededBookings.has(a.id)) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, SCENARIO_COUNT / 2)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (selected.length !== SCENARIO_COUNT / 2) {
    throw new Error(
      "Scenario quotations require 50 customer bookings with an open conversation (or existing scenario quotations)",
    );
  }

  const plan = [];

  for (const [index, booking] of selected.entries()) {
    const pkg = await resolveBookingPackageData(db, booking);
    const base = pkg ? basePrice(pkg.price) : null;

    if (!pkg || base === null)
      throw new Error(
        `Scenario quotation booking ${booking.id} needs a priced proposal`,
      );

    const items: QuotationItem[] =
      index % 4 === 0
        ? []
        : [
            {
              id: scenarioId(`quotation-item:${booking.id}:addition`),
              direction: "add",
              kind: "addition",
              description: "Additional event setup (demonstration)",
              amountMinor: 250_050,
              serviceId: null,
            },
            {
              id: scenarioId(`quotation-item:${booking.id}:deduction`),
              direction: "deduct",
              kind: "deduction",
              description: "Courtesy discount (demonstration)",
              amountMinor: 50_025,
              serviceId: null,
            },
          ];
    const total = amount(base, items);

    if (total === null || total < 0)
      throw new Error(
        `Scenario quotation booking ${booking.id} has an invalid total`,
      );

    for (const version of [1, 2]) {
      const status: QuotationStatus =
        version === 1 ? "superseded" : index % 3 === 0 ? "draft" : "sent";
      const createdAt = new Date(
        input.now.getTime() + (version === 1 ? 0 : 3_000),
      );
      const sentAt =
        status === "draft"
          ? null
          : new Date(input.now.getTime() + (version === 1 ? 1_000 : 4_000));
      const supersededAt =
        version === 1 ? new Date(input.now.getTime() + 3_000) : null;
      plan.push({
        booking,
        row: {
          id: quoteId(booking.id, version),
          booking_request_id: booking.id,
          version,
          currency: "PHP",
          base_amount_minor: base,
          total_amount_minor: total,
          items: JSON.stringify(items),
          status,
          created_by: admin.id,
          created_at: createdAt,
          updated_at: supersededAt ?? sentAt ?? createdAt,
          sent_at: sentAt,
          superseded_at: supersededAt,
          offered_package_id: pkg.id,
          adjustments_reviewed: status !== "draft",
          previous_quotation_id: version === 1 ? null : quoteId(booking.id, 1),
          revision_reason:
            version === 1
              ? null
              : "Please review the revised offer (demonstration).",
        },
      });
    }
  }

  expectCount("quotations", plan.length);

  let quotations = 0;
  let quotationMessages = 0;
  let quotationAuditEvents = 0;

  for (const { row, booking } of plan) {
    const inserted = await insertIfNew(db, "quotations", row);

    if (inserted) quotations += 1;

    // Existing quotations may have been revised by the API. Preserve their lifecycle too.
    if (!inserted) continue;

    if (
      row.sent_at &&
      (await insertIfNew(db, "messages", {
        id: scenarioId(`quotation-message:${row.id}`),
        conversation_id: booking.conversation_id,
        sender_id: admin.id,
        sender_role: "admin",
        body: "A quotation is ready for your review.",
        quotation_id: row.id,
        created_at: row.sent_at,
        read_at: null,
      }))
    )
      quotationMessages += 1;

    const events = [
      {
        action: row.version === 1 ? "quotation.created" : "quotation.revised",
        actor: admin.id,
        at: row.created_at,
      },
      ...(row.sent_at && (row.version === 2 || row.items !== "[]")
        ? [
            {
              action: "quotation.updated",
              actor: admin.id,
              at: new Date(row.created_at.getTime() + 500),
            },
          ]
        : []),
      ...(row.sent_at
        ? [{ action: "quotation.sent", actor: admin.id, at: row.sent_at }]
        : []),
    ];

    for (const event of events) {
      if (
        await insertIfNew(db, "audit_events", {
          id: scenarioId(`quotation-audit:${row.id}:${event.action}`),
          actor_id: event.actor,
          action: event.action,
          entity_type: "quotation",
          entity_id: row.id,
          metadata: JSON.stringify({
            bookingRequestId: booking.id,
            version: row.version,
            ...(row.previous_quotation_id
              ? {
                  previousQuotationId: row.previous_quotation_id,
                  reason: row.revision_reason,
                }
              : {}),
          }),
          created_at: event.at,
        })
      )
        quotationAuditEvents += 1;
    }
  }

  return {
    quotations: plan.map(({ row }) => row),
    inserted: { quotations, quotationMessages, quotationAuditEvents },
  };
}
