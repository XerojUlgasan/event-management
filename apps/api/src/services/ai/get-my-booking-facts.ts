import { z } from "zod";
import type { Kysely } from "kysely";
import { centavosToPesos } from "@event-management/contracts/money";
import type { DB } from "../../db/types.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { latestDeliveredQuoteData } from "../../data/quotations/list-quotations.js";
import { latestStatusHistoryData } from "../../data/booking-requests/list-status-history.js";
import { customerDto } from "../quotations/quotation-context.js";

export const getMyBookingFactInputSchema = z.strictObject({});

export type MySentQuotationResult =
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

export type MyRequestHistoryResult =
  | {
      status: "found";
      latestChange: {
        status: string;
        reason: string | null;
        createdAt: string;
      };
    }
  | { status: "no_linked_request" | "no_status_history" };

export class BookingFactAccessDenied extends Error {
  constructor() {
    super("Booking facts are unavailable");
  }
}

async function getOwnedConversationBooking({
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

  if (!conversation.booking_request_id) return null;

  const booking = await findBookingRequestData(
    db,
    conversation.booking_request_id,
    customerId,
  );

  if (!booking) throw new BookingFactAccessDenied();

  return booking.id;
}

export async function getMySentQuotationService({
  db,
  customerId,
  conversationId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
  abortSignal?: AbortSignal;
}): Promise<MySentQuotationResult> {
  abortSignal?.throwIfAborted();
  const bookingId = await getOwnedConversationBooking({
    db,
    customerId,
    conversationId,
  });

  if (!bookingId) return { status: "no_linked_request" };

  const row = await latestDeliveredQuoteData(db, bookingId);
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

export async function getMyRequestHistoryService({
  db,
  customerId,
  conversationId,
  abortSignal,
}: {
  db: Kysely<DB>;
  customerId: string;
  conversationId: string;
  abortSignal?: AbortSignal;
}): Promise<MyRequestHistoryResult> {
  abortSignal?.throwIfAborted();
  const bookingId = await getOwnedConversationBooking({
    db,
    customerId,
    conversationId,
  });

  if (!bookingId) return { status: "no_linked_request" };

  const latest = await latestStatusHistoryData(db, bookingId);
  abortSignal?.throwIfAborted();

  if (!latest) return { status: "no_status_history" };

  return {
    status: "found",
    latestChange: {
      status: latest.status,
      reason: latest.reason,
      createdAt: latest.created_at.toISOString(),
    },
  };
}
