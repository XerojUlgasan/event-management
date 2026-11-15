import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { CreateInput } from "../../controllers/booking-requests/schemas.js";
import { findAvailablePackageData } from "../../data/booking-requests/find-available-package.js";
import { createBookingRequestData } from "../../data/booking-requests/create-booking-request.js";
import { createBookingConversationData } from "../../data/booking-requests/create-booking-conversation.js";
import { addStatusHistoryData } from "../../data/booking-requests/add-status-history.js";
import { error } from "./booking-request-rules.js";
import { bookingRequestDtos } from "./booking-request-response.js";

export async function createBookingRequestService(
  db: Kysely<DB>,
  customerId: string,
  input: CreateInput,
  options: { conversationId?: string; skipDateGuard?: boolean } = {},
) {
  if (!options.skipDateGuard) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: input.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (input.requestedDays.some((day) => day.date < today))
      return error("Choose today or a future date", 400);
  }
  const requestedDays = input.requestedDays
    .map(({ date }) => ({ date, startsAt: null, endsAt: null }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return db.transaction().execute(async (trx) => {
    const pkg = await findAvailablePackageData(trx, input.packageId);
    if (!pkg)
      return error(
        "Package is no longer available. Refresh and try again",
        409,
      );
    if (
      input.packageUpdatedAt &&
      input.packageUpdatedAt !== pkg.updated_at.toISOString()
    )
      return error("Package changed. Refresh and try again", 409);

    if (options.conversationId) {
      const conv = await trx
        .selectFrom("conversations")
        .select(["id", "customer_id", "booking_request_id"])
        .where("id", "=", options.conversationId)
        .forUpdate()
        .executeTakeFirst();
      if (!conv)
        return error("Conversation not found", 404 as 400 | 404 | 409);
      if (conv.customer_id !== customerId)
        return error("Conversation does not belong to this customer", 400);
      if (conv.booking_request_id !== null)
        return error("Conversation already has a booking", 409);
    }

    const row = await createBookingRequestData(trx, {
      reference: `BR-${randomUUID().toUpperCase()}`,
      customer_id: customerId,
      package_id: input.packageId,
      package_name: pkg.name,
      package_price: pkg.price,
      package_max_guests: pkg.max_guests,
      event_type: input.eventType,
      preferred_date: requestedDays[0]!.date,
      requested_days: JSON.stringify(requestedDays),
      estimated_duration: "undecided",
      estimated_duration_days: null,
      starts_at: null,
      ends_at: null,
      time_zone: input.timeZone,
      guest_count: input.guestCount ?? null,
      contact_name: input.contactName,
      phone_number: input.phoneNumber,
      preferred_venue_location: null,
      special_requests: input.specialRequests || null,
      status: "under_review",
      out_of_range:
        input.guestCount != null && input.guestCount > pkg.max_guests,
    });
    await addStatusHistoryData(trx, row.id, "under_review", customerId, null);

    if (options.conversationId) {
      await trx
        .updateTable("conversations")
        .set({ booking_request_id: row.id })
        .where("id", "=", options.conversationId)
        .execute();
    } else {
      await createBookingConversationData(trx, {
        customer_id: customerId,
        booking_request_id: row.id,
      });
    }

    return (await bookingRequestDtos(trx, [row]))[0]!;
  });
}
