import { calendarDateInTimeZone } from "@event-management/contracts/calendar-date";
import type { ReviewedBookingService } from "@event-management/contracts/booking-draft";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { servicePricingSchema } from "@event-management/contracts/catalog-service-terms";
import { MAX_BOOKING_ADDON_HOURS } from "@event-management/contracts/limits/booking-requests";
import { randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { CreateInput } from "../../controllers/booking-requests/schemas.js";
import { findAvailablePackageData } from "../../data/booking-requests/find-available-package.js";
import { createBookingRequestData } from "../../data/booking-requests/create-booking-request.js";
import { createBookingConversationData } from "../../data/booking-requests/create-booking-conversation.js";
import { addStatusHistoryData } from "../../data/booking-requests/add-status-history.js";
import {
  bookingRevision,
  nextBookingRevision,
} from "../../data/booking-requests/booking-revision.js";
import { createNotificationData } from "../../data/notifications/create-notification.js";
import { lockRequestedAddonServices } from "../../data/booking-requests/lock-requested-addon-services.js";
import { canvasServiceIds } from "../../utils/catalog-canvas.js";
import { error } from "./booking-request-rules.js";
import { bookingRequestDtos } from "./booking-request-response.js";

const addonConflict = (resourceId: string, message: string) => ({
  ...error(message, 409),
  code: "requested_addon_conflict" as const,
  resourceId,
});

export async function createBookingRequestService(
  db: Kysely<DB>,
  customerId: string,
  input: CreateInput,
) {
  return db.transaction().execute(async (trx) => {
    const row = await createBookingRequestInTransaction(trx, customerId, input);

    if ("message" in row) return row;

    return (await bookingRequestDtos(trx, [row]))[0]!;
  });
}

export async function createBookingRequestInTransaction(
  trx: Transaction<DB>,
  customerId: string,
  input: CreateInput,
  extra?: { budget?: string; requestedServices: ReviewedBookingService[] },
) {
  const today = calendarDateInTimeZone(new Date(), input.timeZone);

  if (input.requestedDays.some((day) => day.date < today))
    return error("Choose today or a future date", 400);

  const requestedDays = input.requestedDays
    .map(({ date }) => ({ date, startsAt: null, endsAt: null }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const conversation = input.conversationId
    ? await trx
        .selectFrom("conversations")
        .select(["booking_request_id", "customer_id", "guest_identity_id"])
        .where("id", "=", input.conversationId)
        .forUpdate()
        .executeTakeFirst()
    : undefined;

  if (
    input.conversationId &&
    (!conversation ||
      conversation.customer_id !== customerId ||
      conversation.guest_identity_id)
  )
    return error("Conversation is unavailable", 409);

  const pkg = input.packageId
    ? await findAvailablePackageData(trx, input.packageId)
    : undefined;

  if (input.packageId && !pkg)
    return error("Package is no longer available. Refresh and try again", 409);

  if (
    input.packageUpdatedAt &&
    (!pkg || input.packageUpdatedAt !== pkg.updated_at.toISOString())
  )
    return {
      ...error("Package changed. Refresh and try again", 409),
      code: "booking_package_changed" as const,
    };

  const addons = input.requestedAddons ?? [];
  const requestedServices: ReviewedBookingService[] = [];
  if (addons.length) {
    const rows = await lockRequestedAddonServices(
      trx,
      addons.map((item) => item.serviceId),
    );
    const services = new Map(rows.map((row) => [row.id, row]));
    const included = pkg
      ? canvasServiceIds(storedSectionsSchema.parse(pkg.canvas))
      : new Set<string>();

    for (const item of addons) {
      const service = services.get(item.serviceId);
      if (!service)
        return addonConflict(
          item.serviceId,
          "A selected service is no longer available. Remove it or try again.",
        );
      if (service.updated_at.toISOString() !== item.serviceUpdatedAt)
        return addonConflict(
          service.id,
          `${service.name} changed. Refresh and review its terms.`,
        );
      if (included.has(service.id))
        return addonConflict(
          service.id,
          `${service.name} is already included in the selected package`,
        );

      const pricing = servicePricingSchema.safeParse({
        hourlyRatePesos: service.hourly_rate_pesos,
        fixedPricePesos: service.fixed_price_pesos,
        includedHours: service.included_hours,
      });
      if (!pricing.success)
        return addonConflict(
          service.id,
          `${service.name} has unavailable pricing. Refresh and try again`,
        );
      const hours = (pricing.data.includedHours ?? 0) + item.hours;
      if (hours <= 0 || hours > MAX_BOOKING_ADDON_HOURS)
        return error(`Choose valid hours for ${service.name}`, 400);

      requestedServices.push({
        serviceId: service.id,
        name: service.name,
        hours,
        notes: null,
        included: false,
        updatedAt: service.updated_at.toISOString(),
        catalogPricing: pricing.data,
      });
    }
  }

  const services = extra?.requestedServices ?? requestedServices;
  const values = {
    customer_id: customerId,
    package_id: input.packageId ?? null,
    event_type: input.eventType,
    preferred_date: requestedDays[0]!.date,
    requested_days: JSON.stringify(requestedDays),
    estimated_duration: "undecided",
    estimated_duration_days: null,
    duration_mode: input.durationMode,
    starts_at: null,
    ends_at: null,
    time_zone: input.timeZone,
    guest_count: input.guestCount ?? null,
    contact_name: input.contactName,
    phone_number: input.phoneNumber,
    preferred_venue_location: input.preferredVenueLocation ?? null,
    special_requests: input.specialRequests || null,
    budget: extra?.budget ?? null,
    requested_services: services.length ? JSON.stringify(services) : null,
    status: "under_review",
    out_of_range:
      pkg != null &&
      input.guestCount != null &&
      input.guestCount > pkg.max_guests,
  };

  const draftId = conversation?.booking_request_id;
  const row = draftId
    ? await trx
        .updateTable("booking_requests")
        .set({
          ...values,
          updated_at: nextBookingRevision,
          submitted_at: sql<Date>`clock_timestamp()`,
        })
        .where("id", "=", draftId)
        .where("customer_id", "=", customerId)
        .where("submitted_at", "is", null)
        .returningAll()
        .returning(bookingRevision.as("revision"))
        .executeTakeFirst()
    : await createBookingRequestData(trx, {
        ...values,
        reference: `BR-${randomUUID().toUpperCase()}`,
      });

  if (!row) return error("Conversation is unavailable", 409);

  await addStatusHistoryData(trx, row.id, "under_review", customerId, null);

  if (input.conversationId && !draftId) {
    await trx
      .updateTable("conversations")
      .set({ booking_request_id: row.id })
      .where("id", "=", input.conversationId)
      .execute();
  } else if (!input.conversationId) {
    await createBookingConversationData(trx, {
      customer_id: customerId,
      booking_request_id: row.id,
    });
  }

  await createNotificationData(trx, { role: "admin" }, row.id, {
    type: "booking_request_created",
    payload: { bookingRequestId: row.id, bookingReference: row.reference },
  });

  return row;
}
