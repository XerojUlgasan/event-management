import { SignJWT } from "jose";
import type { SessionContext } from "../../types/hono.js";
import { config } from "../../env.js";

const MAX_TOKEN_LIFETIME_SECONDS = 5 * 60;

export type RealtimeTokenTarget =
  { conversationId: string } | { scope: "notifications" };

export async function signRealtimeToken(
  target: RealtimeTokenTarget,
  session: SessionContext,
  { issuedAt, expiresAt }: { issuedAt: number; expiresAt: number },
) {
  const secret = config.SUP_JWT_KEY;
  const key = new TextEncoder().encode(secret);

  if (!secret?.trim() || key.length < 32)
    throw new Error("Realtime token signer is unavailable");

  const scopeClaims =
    "conversationId" in target
      ? {
          clemora_scope: "conversation_messages",
          conversation_id: target.conversationId,
        }
      : { clemora_scope: "user_notifications" };

  return new SignJWT({
    role: "authenticated",
    clemora_session_id: session.sessionId,
    ...scopeClaims,
  })
    .setSubject(session.user.id)
    .setAudience("authenticated")
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(key);
}

export function getRealtimeTokenLifetime(
  sessionExpiresAt: Date,
  now = Date.now(),
) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = Math.min(
    issuedAt + MAX_TOKEN_LIFETIME_SECONDS,
    Math.floor(sessionExpiresAt.getTime() / 1000),
  );

  return { issuedAt, expiresAt };
}
