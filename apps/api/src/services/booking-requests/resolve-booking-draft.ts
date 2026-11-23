import { createHash } from "node:crypto";
import type {
  BookingDraftFields,
  ReviewedBookingService,
} from "@event-management/contracts/booking-draft";
import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { MAX_SPECIAL_REQUESTS_LENGTH } from "@event-management/contracts/limits/booking-requests";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { createSchema } from "../../controllers/booking-requests/schemas.js";
import { readBookingDraftCatalog } from "../../data/booking-requests/read-booking-draft-catalog.js";
import { canvasServiceIds } from "../../utils/catalog-canvas.js";

export async function resolveBookingDraft(
  trx: Transaction<DB>,
  fields: BookingDraftFields,
  lock = false,
) {
  const selections = fields.requestedServices ?? [];

  const { pkg, services } = await readBookingDraftCatalog(
    trx,
    fields.packageId,
    selections.flatMap((service) =>
      service.serviceId ? [service.serviceId] : [],
    ),
    lock,
  );

  const included = pkg
    ? canvasServiceIds(storedSectionsSchema.parse(pkg.canvas))
    : new Set<string>();
  const missingFields = new Set<string>();
  const warnings: string[] = [];
  const requestedServices: ReviewedBookingService[] = [];

  for (const item of selections) {
    const service = item.serviceId ? services.get(item.serviceId) : undefined;

    if (item.serviceId && !service) {
      missingFields.add("requestedServices");
      continue;
    }

    requestedServices.push({
      serviceId: service?.id ?? null,
      name: service?.name ?? item.customName!,
      hours: item.hours ?? null,
      notes: item.notes ?? null,
      included: Boolean(service && included.has(service.id)),
      updatedAt: service?.revision ?? null,
    });
  }

  if (missingFields.has("requestedServices"))
    warnings.push(
      "A selected catalog service is unavailable. Remove it, choose a replacement, or request it in your own words.",
    );

  if (fields.packageId && !pkg) {
    missingFields.add("packageId");
    warnings.push(
      "The selected package is unavailable. Choose another package or continue without one.",
    );
  }

  const outOfRange =
    pkg != null &&
    fields.guestCount != null &&
    fields.guestCount > pkg.max_guests;

  if (outOfRange)
    warnings.push(
      `Your guest count exceeds this package’s listed capacity of ${pkg.max_guests}. AMAC will review the fit.`,
    );

  const result = createSchema.safeParse({
    eventType: fields.eventType,
    durationMode: fields.durationMode,
    requestedDays: fields.requestedDates?.map((date) => ({ date })),
    timeZone: fields.timeZone,
    contactName: fields.contactName,
    phoneNumber: fields.phoneNumber,
    guestCount: fields.guestCount,
    preferredVenueLocation: fields.preferredVenueLocation,
    specialRequests: fields.specialRequests,
    packageId: fields.packageId,
    packageUpdatedAt: pkg?.updated_at.toISOString(),
  });

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];

      if (typeof field === "string")
        missingFields.add(field === "requestedDays" ? "requestedDates" : field);
    }
  }

  if (
    fields.specialRequests &&
    fields.specialRequests.length > MAX_SPECIAL_REQUESTS_LENGTH
  )
    warnings.push(
      `The saved special requests exceed ${MAX_SPECIAL_REQUESTS_LENGTH.toLocaleString("en-PH")} characters. Shorten them before submitting.`,
    );

  const today = fields.timeZone
    ? calendarDateInTimeZone(new Date(), fields.timeZone)
    : null;

  if (today && fields.requestedDates?.some((date) => date < today)) {
    missingFields.add("requestedDates");
    warnings.push("Please choose today or future dates in the event timezone.");
  }

  const selectedPackage = pkg
    ? {
        id: pkg.id,
        name: pkg.name,
        price: pkg.price,
        maxGuests: pkg.max_guests,
        revision: pkg.revision,
      }
    : null;

  const catalogFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        selectedPackage,
        services: requestedServices
          .filter((service) => service.serviceId !== null)
          .map(({ serviceId, name, included, updatedAt }) => ({
            serviceId,
            name,
            included,
            updatedAt,
          })),
      }),
    )
    .digest("hex");

  return {
    selectedPackage,
    catalogFingerprint,
    requestedServices,
    outOfRange,
    warnings,
    missingFields: [...missingFields],
    createInput: result.success && !missingFields.size ? result.data : null,
  };
}
