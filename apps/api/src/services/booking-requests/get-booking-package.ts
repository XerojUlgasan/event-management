import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { resolveBookingPackageData } from "../../data/booking-requests/resolve-booking-package.js";
import { packageDto } from "../packages/package-response.js";

export async function getBookingPackageService(
  db: Kysely<DB>,
  id: string,
  customerId?: string,
) {
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const booking = await findBookingRequestData(trx, id, customerId);
      if (!booking) return null;
      const pkg = await resolveBookingPackageData(trx, booking);
      return {
        package: pkg ? await packageDto(trx, pkg) : null,
        bookingUpdatedAt: booking.revision,
      };
    });
}
