import type { Selectable } from "kysely";
import type { Conversations, Messages } from "../../db/types.js";

type ConversationRow = Selectable<Conversations>;

export type ConversationWithCustomer = ConversationRow & {
  ai_reply_pending: boolean;
  customer_display_name: string | null;
  customer_email: string | null;
  package_name: string | null;
  booking_request_id: string | null;
  booking_request_reference: string | null;
  package_id: string | null;
  event_type: string | null;
  event_starts_at: Date | null;
  event_ends_at: Date | null;
  guest_count: number | null;
};

export type MessageWithSender = Selectable<Messages> & {
  images?: unknown[];
  processing?:
    | import("@event-management/contracts/message-images").MessageProcessing
    | null;
  sender_display_name: string | null;
  sender_email: string | null;
};
