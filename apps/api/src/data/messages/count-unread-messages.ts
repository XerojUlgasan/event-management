import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export async function countUnreadMessagesData(
  db: Database,
  conversationIds: string[],
  viewer: "admin" | "customer",
) {
  if (!conversationIds.length) return new Map<string, number>();
  const rows = await db
    .selectFrom("messages as m")
    .select((eb) => ["m.conversation_id", eb.fn.count("m.id").as("count")])
    .where("m.conversation_id", "in", conversationIds)
    .where(
      "m.sender_role",
      "in",
      viewer === "admin" ? ["customer"] : ["admin", "assistant"],
    )
    .where("m.read_at", "is", null)
    .groupBy("m.conversation_id")
    .execute();
  return new Map(rows.map((row) => [row.conversation_id, Number(row.count)]));
}
