import type { Selectable } from "kysely";
import type { Conversations, Messages } from "../../db/types.js";

type ConversationRow = Selectable<Conversations>;

export type ConversationWithCustomer = ConversationRow & {
  customer_display_name: string | null;
  customer_email: string;
  package_name: string | null;
  booking_request_id: string | null;
  booking_request_reference: string | null;
  booking_request_ends_at: Date | null;
};

export type MessageWithSender = Selectable<Messages> & {
  sender_display_name: string | null;
  sender_email: string | null;
};
