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
  lastMessage: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

export type ChatThread = {
  conversation: ChatConversation
  messages: ChatMessage[]
  nextCursor: string | null
}

const cursorQuery = (cursor?: string) => cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
export const getMyConversation = () => request<ChatThread>("/messages/conversation")
export const createMyConversation = () => request<ChatThread>("/messages/conversations", {})
export const getMyConversations = (cursor?: string, reference?: string) => {
  const query = new URLSearchParams()
  if (cursor) query.set("cursor", cursor)
  if (reference) query.set("reference", reference)
  return request<{ conversations: ChatConversation[]; nextCursor: string | null }>(`/messages/conversations${query.size ? `?${query}` : ""}`)
}
export const getMyConversationById = (id: string, cursor?: string) =>
  request<ChatThread>(`/messages/conversations/${encodeURIComponent(id)}${cursorQuery(cursor)}`)
export const sendMyMessage = (body: string, conversationId?: string) =>
  request<{ message: ChatMessage }>("/messages/conversation/messages", { body, conversationId })
export const getAdminConversations = (cursor?: string) =>
  request<{ conversations: ChatConversation[]; nextCursor: string | null }>(`/admin/conversations${cursorQuery(cursor)}`)
export const getAdminConversation = (id: string, cursor?: string) =>
  request<ChatThread>(`/admin/conversations/${encodeURIComponent(id)}${cursorQuery(cursor)}`)
export const sendAdminMessage = (id: string, body: string) =>
  request<{ message: ChatMessage }>(`/admin/conversations/${encodeURIComponent(id)}/messages`, { body })
