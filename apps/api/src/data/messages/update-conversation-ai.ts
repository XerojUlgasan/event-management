import { withConversationActivity } from "../guest-chat/activity.js";
import { parseAiHandoff } from "../../utils/ai-handoff.js";
import type { Kysely } from "kysely";
import { assertGuestActive } from "../guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";

export function updateConversationAiData(
  db: Kysely<DB>,
  id: string,
  aiEnabled: boolean,
  expectedAiVersion: number,
) {
  return db.transaction().execute(async (trx) => {
    const conversation = await trx
      .selectFrom("conversations")
      .selectAll()
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();

    if (!conversation) return { kind: "not-found" as const };

    if (conversation.guest_identity_id) {
      try {
        assertGuestActive(await withConversationActivity(trx, conversation));
      } catch {
        return { kind: "expired" as const };
      }
    }

    if (conversation.ai_version !== expectedAiVersion)
      return { kind: "stale" as const };

    const aiHandoff = parseAiHandoff(conversation.ai_handoff);
    const changed = conversation.ai_enabled !== aiEnabled;
    const aiVersion = conversation.ai_version + (changed ? 1 : 0);

    if (changed)
      await trx
        .updateTable("conversations")
        .set({
          ai_enabled: aiEnabled,
          ai_version: aiVersion,
          ai_handoff: aiHandoff,
        })
        .where("id", "=", id)
        .execute();

    // Preferences do not bump the inbox's last-message ordering.
    return { kind: "ok" as const, aiEnabled, aiVersion, aiHandoff };
  });
}
