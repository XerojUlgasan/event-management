import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type {
  CreateCustomizationRequestInput,
  CustomizationRequestStatus,
} from "../../controllers/customization-requests/schemas.js";
import { lockBookingRequestData, findBookingRequestData } from "../../data/booking-requests/booking-requests.js";
import {
  createCustomizationRequestData,
  findConversationForCustomizationData,
  findCustomizationRequestForUpdateData,
  findMessageForCustomizationData,
  listAdminCustomizationRequestsPageData,
  updateCustomizationRequestData,
} from "../../data/customization-requests/customization-requests.js";
import { createAuditEventData } from "../../data/audit/audit-events.js";
import { bookingResponse } from "../booking-requests/response.js";
import { adminCustomizationRequestDto } from "./response.js";

const error = (message: string, status: 400 | 404 | 409) => ({
  message,
  status,
});

export async function createCustomizationRequestService(
  db: Kysely<DB>,
  bookingId: string,
  actorId: string,
  actorRole: "admin" | "customer",
  input: CreateCustomizationRequestInput,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);
    if (!booking) return error("Booking request not found", 404);
    if (actorRole === "customer" && booking.customer_id !== actorId)
      return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(booking.status))
      return error("This request is closed and cannot be changed", 409);

    if (input.messageId && !input.conversationId)
      return error("A conversation is required to link a message", 400);

    if (input.conversationId) {
      const conversation = await findConversationForCustomizationData(
        trx,
        input.conversationId,
        bookingId,
        booking.customer_id,
      );
      if (!conversation)
        return error("Conversation not found for this request", 404);
      if (input.messageId) {
        const message = await findMessageForCustomizationData(
          trx,
          input.messageId,
          input.conversationId,
        );
        if (!message) return error("Message not found for this conversation", 404);
      }
    }

    const row = await createCustomizationRequestData(trx, {
      booking_request_id: bookingId,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      type: input.type,
      description: input.description,
      direction: input.direction ?? null,
      amount_minor: input.amountMinor ?? null,
      status: "requested",
      decision_reason: null,
      requested_by: booking.customer_id,
      decided_by: null,
      decided_at: null,
    });
    await createAuditEventData(trx, {
      actor_id: actorId,
      action: "customization_request.created",
      entity_type: "customization_request",
      entity_id: row.id,
      metadata: JSON.stringify({
        bookingRequestId: bookingId,
        type: row.type,
      }),
    });
    return (await bookingResponse(trx, [booking]))[0]!;
  });
}

export async function withdrawCustomizationRequestService(
  db: Kysely<DB>,
  id: string,
  customerId: string,
) {
  return db.transaction().execute(async (trx) => {
    const request = await findCustomizationRequestForUpdateData(trx, id);
    if (!request || request.requested_by !== customerId)
      return error("Customization request not found", 404);
    if (request.status !== "requested")
      return error("Only pending requests can be withdrawn", 409);

    await updateCustomizationRequestData(trx, id, {
      status: "withdrawn",
      updated_at: new Date(),
    });
    await createAuditEventData(trx, {
      actor_id: customerId,
      action: "customization_request.withdrawn",
      entity_type: "customization_request",
      entity_id: id,
      metadata: JSON.stringify({ bookingRequestId: request.booking_request_id }),
    });
    const booking = await findBookingRequestData(trx, request.booking_request_id, customerId);
    return booking ? (await bookingResponse(trx, [booking]))[0]! : error("Booking request not found", 404);
  });
}

export async function decideCustomizationRequestService(
  db: Kysely<DB>,
  id: string,
  actorId: string,
  decision: "approved" | "rejected",
  reason?: string | null,
) {
  return db.transaction().execute(async (trx) => {
    const request = await findCustomizationRequestForUpdateData(trx, id);
    if (!request) return error("Customization request not found", 404);
    if (request.status !== "requested")
      return error("Only pending requests can be decided", 409);

    const decidedAt = new Date();
    const decisionReason = reason?.trim() || null;
    await updateCustomizationRequestData(trx, id, {
      status: decision,
      decision_reason: decisionReason,
      decided_by: actorId,
      decided_at: decidedAt,
      updated_at: decidedAt,
    });
    await createAuditEventData(trx, {
      actor_id: actorId,
      action: `customization_request.${decision}`,
      entity_type: "customization_request",
      entity_id: id,
      metadata: JSON.stringify({
        bookingRequestId: request.booking_request_id,
        reason: decisionReason,
      }),
    });
    const booking = await findBookingRequestData(trx, request.booking_request_id);
    return booking ? (await bookingResponse(trx, [booking]))[0]! : error("Booking request not found", 404);
  });
}

export async function listAdminCustomizationRequestsService(
  db: Kysely<DB>,
  input: { status?: CustomizationRequestStatus; cursor?: string; limit: number },
) {
  const rows = await listAdminCustomizationRequestsPageData(db, input);
  const page = rows.slice(0, input.limit);
  return {
    requests: page.map(adminCustomizationRequestDto),
    nextCursor: rows.length > input.limit ? page[page.length - 1]!.id : null,
  };
}
