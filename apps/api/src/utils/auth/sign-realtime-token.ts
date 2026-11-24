import { z } from "@hono/zod-openapi";
import { importJWK, SignJWT } from "jose";
import type { SessionContext } from "../../types/hono.js";
import { config } from "../../env.js";

const MAX_TOKEN_LIFETIME_SECONDS = 5 * 60;

const signingKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  kid: z.string().min(1),
  x: z.string().min(1),
  y: z.string().min(1),
  d: z.string().min(1),
});

export type RealtimeTokenTarget =
  { conversationId: string } | { scope: "notifications" };

export async function signRealtimeToken(
  target: RealtimeTokenTarget,
  session: SessionContext,
  { issuedAt, expiresAt }: { issuedAt: number; expiresAt: number },
) {
  const jwk = config.REALTIME_JWT_SIGNING_JWK;
  const localSecret = config.REALTIME_JWT_SECRET;
  const scopeClaims =
    "conversationId" in target
      ? {
          clemora_scope: "conversation_messages",
          conversation_id: target.conversationId,
        }
      : { clemora_scope: "user_notifications" };
  const payload = new SignJWT({
    role: "authenticated",
    clemora_session_id: session.sessionId,
    ...scopeClaims,
  })
    .setSubject(session.user.id)
    .setAudience("authenticated")
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt);

  if (jwk) {
    const signingKey = signingKeySchema.parse(JSON.parse(jwk));
    const key = await importJWK(signingKey, "ES256");

    return payload
      .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: signingKey.kid })
      .sign(key);
  }

  if (localSecret) {
    const key = new TextEncoder().encode(localSecret);

    if (key.length >= 32)
      return payload.setProtectedHeader({ alg: "HS256", typ: "JWT" }).sign(key);
  }

  throw new Error("Realtime token signer is unavailable");
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
