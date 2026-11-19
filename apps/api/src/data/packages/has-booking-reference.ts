import type { Database } from "../catalog-canvas/catalog-canvas-types.js";

export function hasPackageBookingReferenceData(db: Database, id: string) {
  return db
    .selectFrom("booking_requests")
    .select("id")
    .where("package_id", "=", id)
    .limit(1)
    .executeTakeFirst();
}
