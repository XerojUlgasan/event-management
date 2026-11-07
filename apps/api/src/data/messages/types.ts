import type { Selectable } from "kysely";
import type { Conversations, Messages } from "../../db/types.js";

type ConversationRow = Selectable<Conversations>;

export type ConversationWithCustomer = ConversationRow & {
  customer_display_name: string | null;
  customer_email: string;
  package_name: string | null;
  booking_request_id: string | null;
  booking_request_reference: string | null;
  booking_request_status: string | null;
  package_id: string | null;
  arrangement_id: string | null;
  arrangement_event_type: string | null;
  arrangement_starts_at: Date | null;
  arrangement_ends_at: Date | null;
  arrangement_guest_count: number | null;
  has_pending_customization: boolean;
};

export type MessageWithSender = Selectable<Messages> & {
  sender_display_name: string | null;
  sender_email: string | null;
};
