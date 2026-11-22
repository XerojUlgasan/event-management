import { z } from "zod";
import type { Kysely } from "kysely";
import {
  centavosToPesos,
  pesosToCentavos,
} from "@event-management/contracts/money";
import { calculateQuotationAddonAmount } from "@event-management/contracts/quotations";
import type { DB } from "../../db/types.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { latestDeliveredQuoteData } from "../../data/quotations/list-quotations.js";
import { latestStatusHistoryData } from "../../data/booking-requests/list-status-history.js";
import { getBookingRequestService } from "../booking-requests/get-booking-request.js";
import { customerDto } from "../quotations/quotation-context.js";

export const getMyBookingFactInputSchema = z.strictObject({});

export type LatestQuotationResult =
  | {
      status: "found";
      quotation: {
        version: number;
        currency: string;
        baseAmountPesos: number;
        totalAmountPesos: number;
        sentAt: string;
        items: {
          kind: string;
          direction: string;
          description: string;
          amountPesos: number | null;
        }[];
      };
    }
  | { status: "no_linked_request" | "no_sent_quotation" };

type BookingRequest = NonNullable<
  Awaited<ReturnType<typeof getBookingRequestService>>
>;

export type BookingDetailsResult =
  | {
      status: "found";
      bookingRequest: {
        reference: BookingRequest["reference"];
        status: BookingRequest["status"];
        eventType: BookingRequest["eventType"];
        guestCount: BookingRequest["guestCount"];
        timeZone: BookingRequest["timeZone"];
        requestedDays:
          | {
              date: string;
              startsAt: string | null;
              endsAt: string | null;
              operationalSchedule: Omit<
                NonNullable<
                  NonNullable<
                    BookingRequest["requestedDays"]
                  >[number]["operationalSchedule"]
                >,
                "id"
              > | null;
            }[]
          | null;
        preferredDate: BookingRequest["preferredDate"];
        startsAt: BookingRequest["startsAt"];
        endsAt: BookingRequest["endsAt"];
        durationMode: BookingRequest["durationMode"];
        requestedDayCount: BookingRequest["requestedDayCount"];
        estimatedDuration: BookingRequest["estimatedDuration"];
        estimatedDurationDays: BookingRequest["estimatedDurationDays"];
        preferredVenueLocation: BookingRequest["preferredVenueLocation"];
        specialRequests: BookingRequest["specialRequests"];
        budget: BookingRequest["budget"];
        selectedCatalogPackage: {
          name: string | null;
          maxGuests: number | null;
          pricePesos: number | null;
        } | null;
        requestedServices: (Pick<
          BookingRequest["requestedServices"][number],
          "name" | "hours" | "notes" | "included"
        > & {
          offer?: NonNullable<
            BookingRequest["requestedServices"][number]["offer"]
          > & { amountPesos: number | null };
        })[];
      };
      latestChange: {
        status: string;
        reason: string | null;
        createdAt: string;
      } | null;
    }
  | { status: "no_linked_request" };

function offerAmountPesos(
  offer: NonNullable<BookingRequest["requestedServices"][number]["offer"]>,
) {
  if (offer.totalHours === null) return null;

  const hours =
    offer.includedHours === null
      ? offer.totalHours
      : Math.max(0, offer.totalHours - offer.includedHours);
  const result = calculateQuotationAddonAmount({
    source: {
      packageId: "booking",
      addonId: "booking",
      fixedPriceMinor:
        offer.fixedPricePesos === null
          ? null
          : pesosToCentavos(offer.fixedPricePesos),
      includedHours: offer.includedHours,
      hourlyRateMinor:
        offer.hourlyRatePesos === null
          ? null
          : pesosToCentavos(offer.hourlyRatePesos),
    },
    fixedPriceOverrideMinor: null,
    hourlyRateOverrideMinor: null,
    hours,
  });

  return result.amountMinor === null
    ? null
    : centavosToPesos(result.amountMinor);
}

export class BookingFactAccessDenied extends Error {
  constructor() {
    super("Booking facts are unavailable");
  }
}

async function getOwnedConversationBookingId({
  db,
  customerId,
  conversationId,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
}) {
  const conversation = await findConversationData(db, conversationId);

  // Keep private booking reads unavailable to guest-origin turns. The turn
  // itself also only exposes these tools to an originally signed-in customer.
  if (
    !conversation ||
    conversation.customer_id !== customerId ||
    conversation.guest_identity_id
  )
    throw new BookingFactAccessDenied();

  return conversation.booking_request_id;
}

export async function getLatestQuotationService({
  db,
  customerId,
  conversationId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
  abortSignal?: AbortSignal;
}): Promise<LatestQuotationResult> {
  abortSignal?.throwIfAborted();
  const bookingId = await getOwnedConversationBookingId({
    db,
    customerId,
    conversationId,
  });

  if (!bookingId) return { status: "no_linked_request" };

  const booking = await findBookingRequestData(db, bookingId, customerId);

  if (!booking) throw new BookingFactAccessDenied();

  const row = await latestDeliveredQuoteData(db, booking.id);
  abortSignal?.throwIfAborted();

  if (!row) return { status: "no_sent_quotation" };

  const quotation = customerDto(row);

  // latestDeliveredQuoteData requires sent_at, but retain a defensive failure
  // boundary instead of producing a malformed customer-facing result.
  if (!quotation.sentAt) throw new BookingFactAccessDenied();

  return {
    status: "found",
    quotation: {
      version: quotation.version,
      currency: quotation.currency,
      baseAmountPesos: centavosToPesos(quotation.baseAmountMinor),
      totalAmountPesos: centavosToPesos(quotation.totalAmountMinor),
      sentAt: quotation.sentAt,
      items: quotation.items.map((item) => {
        return {
          kind: item.kind,
          direction: item.direction,
          description: item.description,
          amountPesos:
            item.amountMinor === null
              ? null
              : centavosToPesos(item.amountMinor),
        };
      }),
    },
  };
}

export async function getBookingDetailsService({
  db,
  customerId,
  conversationId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
  abortSignal?: AbortSignal;
}): Promise<BookingDetailsResult> {
  abortSignal?.throwIfAborted();

  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const bookingId = await getOwnedConversationBookingId({
        db: trx,
        customerId,
        conversationId,
      });

      if (!bookingId) return { status: "no_linked_request" };

      const details = await getBookingRequestService(
        trx,
        bookingId,
        customerId,
      );

      if (!details) throw new BookingFactAccessDenied();

      const latest = await latestStatusHistoryData(trx, bookingId);
      abortSignal?.throwIfAborted();

      return {
        status: "found",
        bookingRequest: {
          reference: details.reference,
          status: details.status,
          eventType: details.eventType,
          guestCount: details.guestCount,
          timeZone: details.timeZone,
          requestedDays:
            details.requestedDays?.map(
              ({ date, startsAt, endsAt, operationalSchedule }) => ({
                date,
                startsAt,
                endsAt,
                operationalSchedule: operationalSchedule
                  ? {
                      day: operationalSchedule.day,
                      startsAt: operationalSchedule.startsAt,
                      endsAt: operationalSchedule.endsAt,
                      timeZone: operationalSchedule.timeZone,
                      status: operationalSchedule.status,
                    }
                  : null,
              }),
            ) ?? null,
          preferredDate: details.preferredDate,
          startsAt: details.startsAt,
          endsAt: details.endsAt,
          durationMode: details.durationMode,
          requestedDayCount: details.requestedDayCount,
          estimatedDuration: details.estimatedDuration,
          estimatedDurationDays: details.estimatedDurationDays,
          preferredVenueLocation: details.preferredVenueLocation,
          specialRequests: details.specialRequests,
          budget: details.budget,
          selectedCatalogPackage: details.packageId
            ? {
                name: details.packageName,
                maxGuests: details.packageMaxGuests,
                pricePesos: details.packagePrice
                  ? centavosToPesos(details.packagePrice.amountMinor)
                  : null,
              }
            : null,
          requestedServices: details.requestedServices.map(
            ({ name, hours, notes, included, offer }) => ({
              name,
              hours,
              notes,
              included,
              ...(offer
                ? { offer: { ...offer, amountPesos: offerAmountPesos(offer) } }
                : {}),
            }),
          ),
        },
        latestChange: latest
          ? {
              status: latest.status,
              reason: latest.reason,
              createdAt: latest.created_at.toISOString(),
            }
          : null,
      };
    });
}
