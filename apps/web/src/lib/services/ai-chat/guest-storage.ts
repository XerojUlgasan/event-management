import type { GuestTurn } from "../../data/ai-chat/public-chat";

export type { GuestTurn };

export const GUEST_CHAT_KEY = "clemora-guest-chat";

export function saveGuestTurns(turns: GuestTurn[]): void {
  try {
    localStorage.setItem(GUEST_CHAT_KEY, JSON.stringify(turns));
  } catch {
    /* Storage unavailable — continue without persistence. */
  }
}

export function loadGuestTurns(): GuestTurn[] {
  try {
    const raw = localStorage.getItem(GUEST_CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter(
      (t): t is GuestTurn =>
        typeof t === "object" &&
        t !== null &&
        ((t as GuestTurn).role === "user" ||
          (t as GuestTurn).role === "assistant") &&
        typeof (t as GuestTurn).content === "string",
    );
  } catch {
    return [];
  }
}

export function clearGuestTurns(): void {
  try {
    localStorage.removeItem(GUEST_CHAT_KEY);
  } catch {
    /* ignore */
  }
}
