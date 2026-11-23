import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB>;

type Viewer = { role: "admin" } | { role: "customer"; userId: string };

function incomingRoles(viewer: Viewer["role"]) {
  return viewer === "admin" ? ["customer"] : ["admin", "assistant"];
}

export async function markMessagesReadData(
  db: Database,
  conversation: ConversationWithCustomer,
  viewer: "admin" | "customer",
) {
  await db
    .updateTable("messages")
    .set({ read_at: new Date() })
    .where("conversation_id", "=", conversation.id)
    .where("read_at", "is", null)
    .where("sender_role", "in", incomingRoles(viewer))
    .execute();
}

export function markMessagesReadThroughData(
  db: Database,
  conversationId: string,
  viewer: Viewer,
  messageId: string,
) {
  // Read the saved keyset boundary in Postgres to retain its full timestamp precision.
  return db
    .with("read_boundary", (query) => {
      const boundary = query
        .selectFrom("messages as anchor")
        .innerJoin(
          "conversations as conversation",
          "conversation.id",
          "anchor.conversation_id",
        )
        .select(["anchor.id", "anchor.created_at"])
        .where("conversation.id", "=", conversationId)
        .where("anchor.id", "=", messageId);

      return viewer.role === "customer"
        ? boundary.where("conversation.customer_id", "=", viewer.userId)
        : boundary;
    })
    .with("mark_incoming", (query) =>
      query
        .updateTable("messages")
        .from("read_boundary")
        .set({ read_at: new Date() })
        .where("messages.conversation_id", "=", conversationId)
        .where("messages.read_at", "is", null)
        .where("messages.sender_role", "in", incomingRoles(viewer.role))
        .where(
          ({ ref }) =>
            sql<boolean>`(${ref("messages.created_at")}, ${ref("messages.id")}) <=
            (${ref("read_boundary.created_at")}, ${ref("read_boundary.id")})`,
        )
        .returning("messages.id"),
    )
    .selectFrom("read_boundary")
    .select("id")
    .executeTakeFirst();
}
