import {
  reviewedServiceSchema,
  type ReviewedBookingService,
} from "@event-management/contracts/booking-draft";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { MAX_BOOKING_ADDON_SERVICES } from "@event-management/contracts/limits/booking-requests";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { createAuditEventData } from "../../data/audit/create-audit-event.js";
import {
  bookingRevision,
  nextBookingRevision,
} from "../../data/booking-requests/booking-revision.js";
import { lockAnyPackageData } from "../../data/booking-requests/lock-any-package.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { lockRequestedAddonServices } from "../../data/booking-requests/lock-requested-addon-services.js";
import { resolveBookingPackageData } from "../../data/booking-requests/resolve-booking-package.js";
import type { DB } from "../../db/types.js";
import { canvasServiceIds } from "../../utils/catalog-canvas.js";
import { bookingRequestDtos } from "./booking-request-response.js";
import { error } from "./booking-request-rules.js";

type Offer = NonNullable<ReviewedBookingService["offer"]>;

type Change =
  | { kind: "add"; serviceId: string; offer: Offer }
  | { kind: "edit"; addonId: string; offer: Offer }
  | { kind: "remove"; addonId: string };

export async function changeBookingAddonService(
  db: Kysely<DB>,
  bookingId: string,
  actorId: string,
  expectedBookingUpdatedAt: string,
  change: Change,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);

    if (!booking) return error("Booking request not found", 404);

    if (["declined", "cancelled", "finished"].includes(booking.status))
      return error("Closed booking requests cannot be edited", 409);

    if (booking.revision !== expectedBookingUpdatedAt)
      return error("Booking request changed. Refresh and try again", 409);

    const rows = reviewedServiceSchema
      .array()
      .parse(booking.requested_services ?? []);

    const index = rows.findIndex((row) =>
      change.kind === "add"
        ? row.serviceId === change.serviceId
        : row.id === change.addonId,
    );

    const before = rows[index];

    if (change.kind !== "add" && !before)
      return error("Booking add-on not found", 404);

    let after: ReviewedBookingService | undefined;

    if (change.kind === "remove") {
      if (!before?.offer) return error("Booking add-on not found", 404);

      if (before.origin !== "admin") {
        const { offer: _offer, ...request } = before;
        after = request;
      }
    } else {
      const serviceId =
        change.kind === "add" ? change.serviceId : before?.serviceId;

      if (!serviceId)
        return error("Choose a catalog service for this add-on", 400);

      if (
        rows.some(
          (row, position) =>
            row.offer &&
            row.serviceId === serviceId &&
            (position !== index || change.kind === "add"),
        )
      )
        return error("This service is already a booking add-on", 409);

      if (
        !before?.offer &&
        rows.filter((row) => row.offer).length >= MAX_BOOKING_ADDON_SERVICES
      )
        return error("The booking has reached the add-on limit", 400);

      const proposal = await resolveBookingPackageData(trx, booking);
      const pkg = proposal
        ? await lockAnyPackageData(trx, proposal.id)
        : undefined;

      if (proposal && (!pkg || pkg.archived_at))
        return error("The booking package is unavailable", 409);

      if (
        pkg &&
        canvasServiceIds(storedSectionsSchema.parse(pkg.canvas)).has(serviceId)
      )
        return error("This service is already included in the package", 409);

      const [service] = await lockRequestedAddonServices(trx, [serviceId]);

      if (!service) return error("This service is unavailable", 409);

      after = {
        ...(before ?? {
          serviceId,
          name: service.name,
          hours: null,
          notes: null,
          included: false,
          updatedAt: service.updated_at.toISOString(),
          origin: "admin",
        }),
        id: before?.id ?? randomUUID(),
        offer: change.offer,
      };
    }

    if (index < 0 && after) rows.push(after);
    else if (after) rows[index] = after;
    else rows.splice(index, 1);

    const updated = await trx
      .updateTable("booking_requests")
      .set({
        requested_services: rows.length ? JSON.stringify(rows) : null,
        updated_at: nextBookingRevision,
      })
      .where("id", "=", booking.id)
      .returningAll()
      .returning(bookingRevision.as("revision"))
      .executeTakeFirstOrThrow();

    await createAuditEventData(trx, {
      actor_id: actorId,
      action: "booking.addon_changed",
      entity_type: "booking_request",
      entity_id: booking.id,
      metadata: JSON.stringify({
        before: before ?? null,
        after: after ?? null,
      }),
    });

    const [bookingRequest] = await bookingRequestDtos(trx, [updated]);

    return { bookingRequest: bookingRequest! };
  });
}
