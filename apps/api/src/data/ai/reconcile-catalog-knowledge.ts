import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { listCatalogKnowledgeData } from "./list-catalog-knowledge.js";
import type { CatalogKnowledgeOwner } from "./catalog-knowledge-types.js";

export async function reconcileCatalogKnowledgeData(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
  chunks: Array<{
    chunkKey: string;
    contentMarkdown: string;
    mediaId: string | null;
    sourceHash: string;
  }>,
) {
  const current = await listCatalogKnowledgeData(trx, owner);
  const byKey = new Map(current.map((row) => [row.chunk_key, row]));
  const desiredKeys = new Set(chunks.map((chunk) => chunk.chunkKey));
  const removed = current.filter((row) => !desiredKeys.has(row.chunk_key));
  if (removed.length)
    await trx
      .deleteFrom("catalog_knowledge")
      .where(
        "id",
        "in",
        removed.map((row) => row.id),
      )
      .execute();
  for (const chunk of chunks) {
    const previous = byKey.get(chunk.chunkKey);
    if (
      previous &&
      (previous.content_hash === chunk.sourceHash ||
        previous.content_hash.startsWith(`${chunk.sourceHash}:`))
    ) {
      if (previous.media_id !== chunk.mediaId)
        await trx
          .updateTable("catalog_knowledge")
          .set({ media_id: chunk.mediaId })
          .where("id", "=", previous.id)
          .execute();
      continue;
    }
    // Replacing the row also invalidates unfinished workers after A -> B -> A edits.
    if (previous)
      await trx
        .deleteFrom("catalog_knowledge")
        .where("id", "=", previous.id)
        .execute();
    await trx
      .insertInto("catalog_knowledge")
      .values({
        package_id: owner.kind === "package" ? owner.id : null,
        service_id: owner.kind === "service" ? owner.id : null,
        chunk_key: chunk.chunkKey,
        content_markdown: chunk.contentMarkdown,
        media_id: chunk.mediaId,
        content_hash: chunk.sourceHash,
        embedding: null,
        embedding_model: null,
        embedded_at: null,
      })
      .execute();
  }
  return listCatalogKnowledgeData(trx, owner);
}
