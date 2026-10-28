import type { ConversationWithCustomer, MessageWithSender } from "../../data/messages/types.js";

export type MessageDto = {
  id: string;
  body: string;
  senderId: string;
  senderRole: "admin" | "customer";
  senderName: string;
  createdAt: string;
  readAt: string | null;
};

export type ConversationDto = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
};

export function messageDto(row: MessageWithSender, customerId: string): MessageDto {
  return {
    id: row.id, body: row.body, senderId: row.sender_id,
    senderRole: row.sender_id === customerId ? "customer" : "admin",
    senderName: row.sender_display_name ?? row.sender_email,
    createdAt: row.created_at.toISOString(), readAt: row.read_at?.toISOString() ?? null,
  };
}

export function conversationDto(row: ConversationWithCustomer, lastMessage: MessageDto | null, unreadCount: number): ConversationDto {
  return {
    id: row.id, customerId: row.customer_id,
    customerName: row.customer_display_name ?? row.customer_email,
    customerEmail: row.customer_email, lastMessage, unreadCount,
    updatedAt: row.updated_at.toISOString(),
  };
}

