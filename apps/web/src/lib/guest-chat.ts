import {
  claimGuestConversation,
  requestStaffAssistance,
  type ChatThread,
  type ConversationContextInput,
  type GuestChatMessage,
} from "./api"

const STORAGE_KEY = "clemora.guest-chat.v1"
const EXPIRY_MS = 24 * 60 * 60 * 1000

export type GuestChatEntry = {
  id: string
  role: "user" | "assistant"
  body: string
  createdAt: string
}

export type GuestChatContext = {
  eventType: string | null
  eventStartsAt: string | null
  eventEndsAt: string | null
  guestCount: number | null
}

export type GuestChat = {
  guestChatId: string
  messages: GuestChatEntry[]
  context: GuestChatContext
  needsStaff: boolean
  updatedAt: string
}

const emptyContext = (): GuestChatContext => ({
  eventType: null,
  eventStartsAt: null,
  eventEndsAt: null,
  guestCount: null,
})

const greeting = (): GuestChatEntry => ({
  id: crypto.randomUUID(),
  role: "assistant",
  body:
    "Hi, I’m Clemora’s AI planning assistant. Tell me about your occasion, guest count, or what you have in mind. I can explain published packages and help you prepare an inquiry. I can’t confirm dates, bookings, or payments.",
  createdAt: new Date().toISOString(),
})

function freshChat(): GuestChat {
  const now = new Date().toISOString()
  return {
    guestChatId: crypto.randomUUID(),
    messages: [greeting()],
    context: emptyContext(),
    needsStaff: false,
    updatedAt: now,
  }
}

function isGuestChat(value: unknown): value is GuestChat {
  if (!value || typeof value !== "object") return false
  const chat = value as Partial<GuestChat>
  return (
    typeof chat.guestChatId === "string" &&
    Array.isArray(chat.messages) &&
    typeof chat.updatedAt === "string" &&
    !!chat.context &&
    typeof chat.context === "object"
  )
}

export function loadGuestChat(): GuestChat {
  if (typeof window === "undefined") return freshChat()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")
    if (!isGuestChat(parsed)) return freshChat()
    if (Date.parse(parsed.updatedAt) <= Date.now() - EXPIRY_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return freshChat()
    }
    return {
      ...parsed,
      context: { ...emptyContext(), ...parsed.context },
      messages: parsed.messages.length ? parsed.messages : [greeting()],
      needsStaff: parsed.needsStaff === true,
    }
  } catch {
    return freshChat()
  }
}

export function saveGuestChat(chat: GuestChat) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...chat, updatedAt: new Date().toISOString() }),
  )
}

export function clearGuestChat() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function hasGuestHistory(chat: GuestChat) {
  return chat.messages.some((message) => message.role === "user")
}

export function guestChatMessages(chat: GuestChat, limit = 30): GuestChatMessage[] {
  // The public assistant accepts the latest 30 turns; claims accept the latest 50.
  return chat.messages.slice(-limit).map((message) => ({
    role: message.role,
    body: message.body,
    createdAt: message.createdAt,
  }))
}

export function guestChatContext(chat: GuestChat): ConversationContextInput {
  const context: ConversationContextInput = {}
  if (chat.context.eventType) context.eventType = chat.context.eventType
  if (chat.context.eventStartsAt) context.eventStartsAt = chat.context.eventStartsAt
  if (chat.context.eventEndsAt) context.eventEndsAt = chat.context.eventEndsAt
  if (chat.context.guestCount) context.guestCount = chat.context.guestCount
  return context
}

async function claimGuestChat(chat: GuestChat): Promise<ChatThread> {
  const payload = {
    guestChatId: chat.guestChatId,
    messages: guestChatMessages(chat, 50),
    context: guestChatContext(chat),
  }
  return claimGuestConversation(payload)
}

let pendingClaim: Promise<ChatThread | null> | null = null

// Import a browser-only guest conversation once a customer signs in. The
// server treats repeated claims of the same guestChatId as idempotent, and
// this in-flight guard keeps polls from posting the same claim twice.
export function claimPendingGuestChat(): Promise<ChatThread | null> {
  pendingClaim ??= (async () => {
    if (typeof window === "undefined") return null
    const chat = loadGuestChat()
    if (!hasGuestHistory(chat)) return null
    try {
      const claimed = await claimGuestChat(chat)
      // A guest who asked for a person should land in the staff queue, not
      // back with the assistant. Claiming is idempotent if this retries.
      const thread = chat.needsStaff
        ? await requestStaffAssistance(claimed.conversation.id)
        : claimed
      clearGuestChat()
      return thread
    } catch {
      // Keep the browser copy so a later visit can retry the import.
      return null
    }
  })().finally(() => {
    pendingClaim = null
  })
  return pendingClaim
}
