import type { ChatMessage } from "@event-management/contracts/messages";
import { parseAiHandoff } from "../../utils/ai-handoff.js";
import type { ConversationWithCustomer } from "../../data/messages/types.js";

export { messageDto } from "../../utils/message-dto.js";

export type MessageDto = ChatMessage;

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
  eventPreferredDate: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  guestCount: number | null;
  aiEnabled: boolean;
  aiVersion: number;
  aiReplyPending: boolean;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
  aiHandoff?: ReturnType<typeof parseAiHandoff>;
};

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
    eventPreferredDate: row.event_preferred_date,
    eventStartsAt: row.event_starts_at
      ? new Date(row.event_starts_at).toISOString()
      : null,
    eventEndsAt: row.event_ends_at
      ? new Date(row.event_ends_at).toISOString()
      : null,
    guestCount: row.guest_count,
    aiEnabled: row.ai_enabled,
    aiVersion: row.ai_version,
    aiReplyPending: row.ai_reply_pending,
    ...(viewer === "admin"
      ? { aiHandoff: parseAiHandoff(row.ai_handoff) }
      : {}),
    lastMessage,
    unreadCount,
    updatedAt: row.updated_at.toISOString(),
  };
}
