import type {
  AdminCustomizationRequestRow,
  CustomizationRequestRow,
} from "../../data/customization-requests/customization-requests.js";
import type { CustomizationRequestStatus } from "../../controllers/customization-requests/schemas.js";
import type { CustomizationRequestType } from "@event-management/contracts/limits/booking-requests";

const displayName = (name: string | null, email: string) => name ?? email;

export function customizationRequestDto(row: CustomizationRequestRow) {
  return {
    id: row.id,
    bookingRequestId: row.booking_request_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    type: row.type as CustomizationRequestType,
    description: row.description,
    direction: (row.direction ?? null) as "add" | "deduct" | null,
    amountMinor: row.amount_minor ?? null,
    status: row.status as CustomizationRequestStatus,
    decisionReason: row.decision_reason,
    requestedBy: row.requested_by,
    requestedByName: displayName(row.requested_by_name, row.requested_by_email),
    decidedBy: row.decided_by,
    decidedByName: row.decided_by
      ? displayName(row.decided_by_name, row.decided_by_email ?? "")
      : null,
    decidedAt: row.decided_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function adminCustomizationRequestDto(
  row: AdminCustomizationRequestRow,
) {
  return {
    ...customizationRequestDto(row),
    bookingRequestReference: row.booking_request_reference,
    customerName: displayName(row.customer_display_name, row.customer_email),
    packageName: row.package_name,
    eventType: row.event_type,
  };
}
