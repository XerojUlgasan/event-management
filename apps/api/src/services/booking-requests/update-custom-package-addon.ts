import type { PackageAddonService } from "@event-management/contracts/catalog";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { packageAddonServicesSchema } from "@event-management/contracts/catalog-service-terms";
import type { Kysely } from "kysely";
import { lockAnyPackageData } from "../../data/booking-requests/lock-any-package.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { updateCustomPackageAddonsData } from "../../data/booking-requests/update-custom-package-addons.js";
import { lockCanvasServiceData } from "../../data/catalog-canvas/catalog-canvas-queries.js";
import type { DB } from "../../db/types.js";
import { canvasServiceIds } from "../../utils/catalog-canvas.js";
import { serviceError } from "../../utils/service-result.js";
import { packageDto } from "../packages/package-response.js";
import { nextUpdate } from "../packages/package-rules.js";
import { customPackageResult } from "./custom-package-result.js";

type Pricing = Pick<
  PackageAddonService,
  "fixedPricePesos" | "includedHours" | "hourlyRatePesos"
>;

export async function updateCustomPackageAddonService(
  db: Kysely<DB>,
  bookingId: string,
  actorId: string,
  addonId: string,
  source: {
    packageId: string;
    expectedBookingUpdatedAt: string;
    expectedUpdatedAt: string;
  },
  pricing: Pricing | null,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);

    if (!booking) return serviceError("Booking request not found", 404);

    if (["declined", "cancelled"].includes(booking.status))
      return serviceError("Closed booking requests cannot be customized", 409);

    if (booking.revision !== source.expectedBookingUpdatedAt)
      return serviceError(
        "Booking or package changed. Refresh and try again",
        409,
      );

    const pkg = await lockAnyPackageData(trx, source.packageId);

    if (
      !pkg ||
      pkg.archived_at ||
      pkg.package_type !== "custom" ||
      pkg.custom_for_booking_request_id !== booking.id ||
      pkg.updated_at.toISOString() !== source.expectedUpdatedAt
    )
      return serviceError(
        "Booking or package changed. Refresh and try again",
        409,
      );

    const addons = packageAddonServicesSchema.parse(pkg.addon_services);

    const index = addons.findIndex(
      (addon) => addon.id.toLowerCase() === addonId.toLowerCase(),
    );

    const addon = addons[index];

    if (!addon) return serviceError("Package add-on not found", 404);

    if (pricing) {
      const service = await lockCanvasServiceData(trx, addon.serviceId);

      if (!service || service.archived_at)
        return serviceError("This add-on service is unavailable", 409);

      if (
        canvasServiceIds(storedSectionsSchema.parse(pkg.canvas)).has(
          addon.serviceId.toLowerCase(),
        )
      )
        return serviceError(
          "A service cannot be both included and an add-on",
          409,
        );
    }

    const updatedAddons = pricing
      ? addons.map((item, i) => (i === index ? { ...item, ...pricing } : item))
      : addons.filter((_, i) => i !== index);

    const before = await packageDto(trx, pkg);
    const saved = await updateCustomPackageAddonsData(
      trx,
      pkg.id,
      updatedAddons,
      nextUpdate(pkg.updated_at),
    );

    return customPackageResult(trx, {
      bookingId,
      actorId,
      create: false,
      before,
      saved,
    });
  });
}
