import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { nextBookingRevision } from "./booking-revision.js";

export const attachBookingPackageData = (
  db: Transaction<DB>,
  id: string,
  packageId: string,
  outOfRange: boolean,
) =>
  db
    .updateTable("booking_requests")
    .set({
      package_id: packageId,
      out_of_range: outOfRange,
      updated_at: nextBookingRevision,
    })
    .where("id", "=", id)
    .execute();
