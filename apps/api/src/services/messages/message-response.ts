import type { ConversationWithCustomer, MessageWithSender } from "../../data/messages/types.js";
import { conversationExpiresAt } from "../../utils/conversation-expiry.js";

export type MessageDto = {
  id: string;
  body: string;
  senderId: string | null;
  senderRole: "admin" | "customer" | "assistant";
  senderName: string;
  createdAt: string;
  readAt: string | null;
};

export type ConversationDto = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  packageId: string | null;
  packageName: string | null;
  eventType: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  guestCount: number | null;
  status: "active" | "waiting_staff" | "staff" | "closed";
  closedAt: string | null;
  expiresAt: string;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
};

export function messageDto(row: MessageWithSender): MessageDto {
  const role: MessageDto["senderRole"] =
    row.sender_role === "admin" || row.sender_role === "assistant"
      ? row.sender_role
      : "customer";
  return {
    id: row.id,
    body: row.body,
    senderId: row.sender_id,
    senderRole: role,
    senderName:
      role === "assistant"
        ? "Clemora assistant"
        : row.sender_display_name ?? row.sender_email ?? "Clemora team",
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}

export function conversationDto(
  row: ConversationWithCustomer,
  lastMessage: MessageDto | null,
  unreadCount: number,
): ConversationDto {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_display_name ?? row.customer_email,
    customerEmail: row.customer_email,
    packageId: row.package_id,
    packageName: row.package_name,
    eventType: row.event_type,
    eventStartsAt: row.event_starts_at
      ? new Date(row.event_starts_at).toISOString()
      : null,
    eventEndsAt: row.event_ends_at ? new Date(row.event_ends_at).toISOString() : null,
    guestCount: row.guest_count,
    status: row.status as ConversationDto["status"],
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    expiresAt: conversationExpiresAt(row.event_ends_at, row.updated_at).toISOString(),
    lastMessage,
    unreadCount,
    updatedAt: row.updated_at.toISOString(),
  };
}
