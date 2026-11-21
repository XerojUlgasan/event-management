import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { SessionContext } from "../../types/hono.js";
import { findRealtimeConversationData } from "../../data/auth/find-realtime-conversation.js";
import {
  getRealtimeTokenLifetime,
  signRealtimeToken,
  type RealtimeTokenTarget,
} from "../../utils/auth/sign-realtime-token.js";

export async function issueRealtimeTokenService(
  db: Kysely<DB>,
  session: SessionContext,
  requestedTarget: RealtimeTokenTarget,
) {
  const permittedTarget =
    "conversationId" in requestedTarget
      ? await findRealtimeConversationData(
          db,
          session,
          requestedTarget.conversationId,
        )
      : requestedTarget;
  const lifetime = getRealtimeTokenLifetime(session.expiresAt);

  if (lifetime.expiresAt <= lifetime.issuedAt)
    return { kind: "session-expired" as const };

  if (!permittedTarget) return { kind: "not-found" as const };

  try {
    const token = await signRealtimeToken(permittedTarget, session, lifetime);
    const expiresAt = new Date(lifetime.expiresAt * 1000).toISOString();

    return { kind: "ok" as const, token, expiresAt };
  } catch {
    return { kind: "unavailable" as const };
  }
}
