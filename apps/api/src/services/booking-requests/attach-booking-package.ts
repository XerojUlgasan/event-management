import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findAvailablePackageData } from "../../data/booking-requests/find-available-package.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { findCustomPackageData } from "../../data/booking-requests/find-custom-package.js";
import { attachBookingPackageData } from "../../data/booking-requests/attach-booking-package.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { createAuditEventData } from "../../data/audit/create-audit-event.js";
import { bookingRequestDtos } from "./booking-request-response.js";
import { error } from "./booking-request-rules.js";

export async function attachBookingPackageService(
  db: Kysely<DB>,
  id: string,
  actor: string,
  input: {
    packageId: string;
    expectedBookingUpdatedAt: string;
    packageUpdatedAt?: string;
  },
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, id);
    if (!booking) return error("Booking request not found", 404);
    if (
      booking.revision !== input.expectedBookingUpdatedAt ||
      booking.package_id ||
      (await findCustomPackageData(trx, id)) ||
      ["declined", "cancelled"].includes(booking.status)
    )
      return error("Booking request changed or already has a package", 409);
    const pkg = await findAvailablePackageData(trx, input.packageId);
    if (
      !pkg ||
      (input.packageUpdatedAt &&
        input.packageUpdatedAt !== pkg.updated_at.toISOString())
    )
      return error("Package is unavailable or changed", 409);
    await attachBookingPackageData(
      trx,
      id,
      pkg.id,
      booking.guest_count != null && booking.guest_count > pkg.max_guests,
    );
    await createAuditEventData(trx, {
      actor_id: actor,
      action: "booking.catalog_package_attached",
      entity_type: "booking_request",
      entity_id: id,
      metadata: JSON.stringify({ packageId: pkg.id }),
    });
    const updated = await findBookingRequestData(trx, id);
    if (!updated) throw new Error("Booking request unavailable");
    return { bookingRequest: (await bookingRequestDtos(trx, [updated]))[0]! };
  });
}
