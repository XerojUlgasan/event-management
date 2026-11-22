import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export async function supportingDocumentExistsData(db: Kysely<DB>, id: string) {
  return Boolean(
    await db
      .selectFrom("supporting_documents")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}
