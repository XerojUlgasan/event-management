import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { updateConversationAiData } from "../../data/messages/update-conversation-ai.js";

export async function updateConversationAiService(
  db: Kysely<DB>,
  id: string,
  aiEnabled: boolean,
  expectedAiVersion: number,
) {
  const result = await updateConversationAiData(
    db,
    id,
    aiEnabled,
    expectedAiVersion,
  );
  if (result.kind === "ok") return result;
  return {
    kind: "error" as const,
    status: result.kind === "not-found" ? (404 as const) : (409 as const),
    error:
      result.kind === "not-found"
        ? "Conversation not found"
        : result.kind === "closed"
          ? "Conversation is closed"
          : "Conversation changed. Refresh and try again.",
  };
}
