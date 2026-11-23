import { createHash } from "node:crypto";
import {
  MAX_QUOTATION_ITEMS,
  type QuotationItem,
  type SendQuotationInput,
} from "@event-management/contracts/quotations";
import type { Kysely } from "kysely";
import { createAuditEventData } from "../../data/audit/create-audit-event.js";
import { lockAnyPackageData } from "../../data/booking-requests/lock-any-package.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { resolveBookingPackageData } from "../../data/booking-requests/resolve-booking-package.js";
import { createQuotationMessageData } from "../../data/messages/create-quotation-message.js";
import { createNotificationData } from "../../data/notifications/create-notification.js";
import { createQuotationData } from "../../data/quotations/create-quotation.js";
import {
  findQuoteData,
  findQuoteSendAuditData,
} from "../../data/quotations/find-quotation.js";
import {
  latestDeliveredQuoteData,
  latestQuoteVersionData,
} from "../../data/quotations/list-quotations.js";
import { supersedeQuotationData } from "../../data/quotations/update-quotation.js";
import type { DB } from "../../db/types.js";
import { quotationAddons } from "./quotation-addons.js";
import {
  amount,
  basePrice,
  closed,
  dto,
  failure,
} from "./quotation-context.js";

class MissingBookingConversation extends Error {}

export async function sendQuotationService(
  db: Kysely<DB>,
  bookingId: string,
  actor: string,
  input: SendQuotationInput,
) {
  const requestDigest = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

  try {
    return await db.transaction().execute(async (trx) => {
      const booking = await lockBookingRequestData(trx, bookingId);

      if (!booking) return failure("Booking request not found", 404);

      const existing = await findQuoteData(trx, input.requestId);

      if (existing) {
        if (
          existing.booking_request_id === booking.id &&
          existing.created_by === actor &&
          existing.sent_at
        ) {
          const event = await findQuoteSendAuditData(trx, existing.id);
          const metadata = event?.metadata;

          if (
            metadata &&
            typeof metadata === "object" &&
            "requestDigest" in metadata &&
            metadata.requestDigest === requestDigest
          )
            return dto(existing);
        }

        return failure("Quotation send request ID has already been used", 409);
      }

      if (closed(booking)) return failure("This request is closed", 409);

      if (booking.revision !== input.expectedBookingUpdatedAt)
        return failure("Booking request changed. Refresh and try again", 409);

      const resolved = await resolveBookingPackageData(trx, booking);
      const pkg = resolved
        ? await lockAnyPackageData(trx, resolved.id)
        : undefined;

      if (
        !pkg ||
        pkg.archived_at ||
        pkg.id !== input.packageId.toLowerCase() ||
        pkg.updated_at.toISOString() !== input.expectedPackageUpdatedAt
      )
        return failure("Proposal package changed. Refresh and try again", 409);

      const offer = await latestDeliveredQuoteData(trx, booking.id);

      if (
        (offer?.id ?? null) !==
          (input.currentOffer?.id.toLowerCase() ?? null) ||
        (offer?.revision ?? null) !== (input.currentOffer?.updatedAt ?? null)
      )
        return failure("Current offer changed. Refresh and try again", 409);

      if (offer && input.revisionReason === null)
        return failure(
          "Enter a revision reason to replace the current offer",
          400,
        );

      if (!offer && input.revisionReason !== null)
        return failure("A revision reason requires a current offer", 400);

      const base = basePrice(pkg.price);

      if (base === null)
        return failure("Package price is outside the supported range", 400);

      const addons = await quotationAddons(trx, booking, pkg, true);

      if (addons.some((item) => item.addon.requiresRemoval))
        return failure(
          "Remove unavailable or already included booking add-ons before sending",
          409,
        );

      if (addons.some((item) => item.amountMinor === null))
        return failure(
          "Complete booking add-on hours and pricing before sending",
          400,
        );

      const items: QuotationItem[] = [
        ...addons,
        ...input.items.map((item) => ({ ...item, id: item.id.toLowerCase() })),
      ];

      if (
        items.length > MAX_QUOTATION_ITEMS ||
        new Set(items.map((item) => item.id)).size !== items.length
      )
        return failure(
          "Quotation items exceed the limit or contain duplicate IDs",
          400,
        );

      const total = amount(base, items);

      if (total === null || total < 0)
        return failure("Quotation total is outside the supported range", 400);

      const version = (await latestQuoteVersionData(trx, booking.id)) + 1;
      const now = new Date();

      // The unique sent-offer index requires this order. A failed delivery
      // rolls back both changes, so readers retain the last delivered offer.
      if (offer?.status === "sent")
        await supersedeQuotationData(trx, offer.id, now);

      const row = await createQuotationData(trx, {
        id: input.requestId,
        booking_request_id: booking.id,
        version,
        currency: "PHP",
        base_amount_minor: base,
        total_amount_minor: total,
        status: "sent",
        sent_at: now,
        created_by: actor,
        offered_package_id: pkg.id,
        items: JSON.stringify(items),
        adjustments_reviewed: true,
        previous_quotation_id: offer?.id ?? null,
        revision_reason: input.revisionReason,
      });

      const conversationId = await createQuotationMessageData(
        trx,
        booking.id,
        actor,
        row.id,
      );

      if (!conversationId) throw new MissingBookingConversation();

      await createAuditEventData(trx, {
        actor_id: actor,
        action: "quotation.sent",
        entity_type: "quotation",
        entity_id: row.id,
        metadata: JSON.stringify({
          bookingRequestId: booking.id,
          version,
          previousQuotationId: offer?.id ?? null,
          revisionReason: input.revisionReason,
          requestDigest,
        }),
      });

      await createNotificationData(
        trx,
        { userId: booking.customer_id },
        row.id,
        {
          type: "quotation_sent",
          payload: {
            conversationId,
            quotationId: row.id,
            version: row.version,
          },
        },
      );

      return dto(row);
    });
  } catch (error) {
    if (error instanceof MissingBookingConversation)
      return failure("Linked conversation not found", 409);

    // Different bookings use independent locks. A simultaneous reuse of
    // the same request ID across bookings can still reach the primary key.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "quotations_pkey"
    )
      return failure("Quotation send request ID has already been used", 409);

    throw error;
  }
}
