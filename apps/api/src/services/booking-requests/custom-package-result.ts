import type { CatalogPackage } from "@event-management/contracts/catalog";
import type { Selectable, Transaction } from "kysely";
import { createAuditEventData } from "../../data/audit/create-audit-event.js";
import { touchBookingRevisionData } from "../../data/booking-requests/booking-revision.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import type { DB, Packages } from "../../db/types.js";
import { packageDto } from "../packages/package-response.js";
import { bookingRequestDtos } from "./booking-request-response.js";

export async function customPackageResult(
  trx: Transaction<DB>,
  input: {
    bookingId: string;
    actorId: string;
    create: boolean;
    before: CatalogPackage | null;
    saved: Selectable<Packages>;
  },
) {
  const { bookingId, actorId, create, before, saved } = input;

  await touchBookingRevisionData(trx, bookingId);
  const updatedBooking = await findBookingRequestData(trx, bookingId);

  if (!updatedBooking) throw new Error("Saved booking request is unavailable");

  const pkg = await packageDto(trx, saved);
  await createAuditEventData(trx, {
    actor_id: actorId,
    action: create
      ? "booking.custom_package_created"
      : "booking.custom_package_updated",
    entity_type: "booking_request",
    entity_id: bookingId,
    metadata: JSON.stringify({
      previousPackageId: before?.id ?? null,
      packageId: saved.id,
      before,
      after: pkg,
    }),
  });
  const [bookingRequest] = await bookingRequestDtos(trx, [updatedBooking]);

  return { package: pkg, bookingRequest };
}
