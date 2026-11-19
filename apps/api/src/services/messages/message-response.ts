import { parseAiHandoff } from "../../utils/ai-handoff.js";
import type {
  ConversationWithCustomer,
  MessageWithSender,
} from "../../data/messages/types.js";

export type MessageDto = {
  id: string;
  body: string;
  quotationId: string | null;
  senderId: string | null;
  senderRole: "admin" | "customer" | "assistant";
  senderName: string;
  createdAt: string;
  readAt: string | null;
};

export type ConversationDto = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  packageId: string | null;
  packageName: string | null;
  bookingRequestId: string | null;
  bookingRequestReference: string | null;
  eventType: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  guestCount: number | null;
  status: "active" | "closed";
  aiEnabled: boolean;
  aiVersion: number;
  closedAt: string | null;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
  aiHandoff?: ReturnType<typeof parseAiHandoff>;
};

export function messageDto(row: MessageWithSender): MessageDto {
  const role: MessageDto["senderRole"] =
    row.sender_role === "assistant"
      ? "assistant"
      : row.sender_role === "admin"
        ? "admin"
        : "customer";

  return {
    id: row.id,
    body: row.body,
    quotationId: row.quotation_id,
    senderId: row.sender_id,
    senderRole: role,
    senderName:
      role === "assistant"
        ? "AMAC AI"
        : (row.sender_display_name ??
          row.sender_email ??
          (role === "customer" ? "Guest" : "Clemora team")),
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}

export function conversationDto(
  row: ConversationWithCustomer,
  lastMessage: MessageDto | null,
  unreadCount: number,
  viewer: "admin" | "customer" = "customer",
): ConversationDto {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_display_name ?? row.customer_email ?? "Guest",
    customerEmail: row.customer_email,
    packageId: row.package_id,
    packageName: row.package_name,
    bookingRequestId: row.booking_request_id,
    bookingRequestReference: row.booking_request_reference,
    eventType: row.event_type,
    eventStartsAt: row.event_starts_at
      ? new Date(row.event_starts_at).toISOString()
      : null,
    eventEndsAt: row.event_ends_at
      ? new Date(row.event_ends_at).toISOString()
      : null,
    guestCount: row.guest_count,
    status: row.status as ConversationDto["status"],
    aiEnabled: row.ai_enabled,
    aiVersion: row.ai_version,
    ...(viewer === "admin"
      ? { aiHandoff: parseAiHandoff(row.ai_handoff) }
      : {}),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    lastMessage,
    unreadCount,
    updatedAt: row.updated_at.toISOString(),
  };
}
