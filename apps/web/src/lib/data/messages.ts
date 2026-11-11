import { request } from "../http"

export type ConversationStatus = "active" | "closed"

export type ChatMessage = {
  id: string
  quotationId: string | null
  body: string
  senderId: string
  senderRole: "admin" | "customer"
  senderName: string
  createdAt: string
  readAt: string | null
}

export type ChatConversation = {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  packageId: string | null
  packageName: string | null
  bookingRequestId: string | null
  bookingRequestReference: string | null
  eventType: string | null
  eventStartsAt: string | null
  eventEndsAt: string | null
  guestCount: number | null
  status: ConversationStatus
  closedAt: string | null
  expiresAt: string
  lastMessage: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

export type ChatThread = {
  conversation: ChatConversation
  messages: ChatMessage[]
}

export const getMyConversation = () => request<ChatThread>("/messages/conversation")
export const createMyConversation = () => request<ChatThread>("/messages/conversations", {})
export const getMyConversations = () => request<{ conversations: ChatConversation[] }>("/messages/conversations")
export const getMyConversationById = (id: string) =>
  request<ChatThread>(`/messages/conversations/${encodeURIComponent(id)}`)
export const sendMyMessage = (body: string, conversationId?: string) =>
  request<{ message: ChatMessage }>("/messages/conversation/messages", { body, conversationId })
export const getAdminConversations = (cursor?: string) =>
  request<{ conversations: ChatConversation[]; nextCursor: string | null }>(
    `/admin/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  )
export const getAdminConversation = (id: string) =>
  request<ChatThread>(`/admin/conversations/${encodeURIComponent(id)}`)
export const sendAdminMessage = (id: string, body: string) =>
  request<{ message: ChatMessage }>(`/admin/conversations/${encodeURIComponent(id)}/messages`, { body })
