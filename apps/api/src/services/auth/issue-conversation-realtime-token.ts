import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { SessionContext } from "../../types/hono.js";
import { findRealtimeConversationData } from "../../data/auth/find-realtime-conversation.js";
import {
  getConversationRealtimeTokenLifetime,
  signConversationRealtimeToken,
} from "../../utils/auth/sign-conversation-realtime-token.js";

export async function issueConversationRealtimeTokenService(
  db: Kysely<DB>,
  session: SessionContext,
  conversationId: string,
) {
  const permitted = await findRealtimeConversationData(
    db,
    session,
    conversationId,
  );
  const lifetime = getConversationRealtimeTokenLifetime(session.expiresAt);

  if (lifetime.expiresAt <= lifetime.issuedAt)
    return { kind: "session-expired" as const };

  if (!permitted) return { kind: "not-found" as const };

  try {
    const token = await signConversationRealtimeToken(
      permitted.id,
      session,
      lifetime,
    );
    const expiresAt = new Date(lifetime.expiresAt * 1000).toISOString();

    return { kind: "ok" as const, token, expiresAt };
  } catch {
    return { kind: "unavailable" as const };
  }
}
