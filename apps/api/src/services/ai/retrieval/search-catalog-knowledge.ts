import {
  KNOWLEDGE_SEARCH_LIMIT,
  type KnowledgeSearchResponse,
  type KnowledgeSearchResult,
} from "@event-management/contracts/catalog-knowledge";
import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import { searchCatalogKnowledgeData } from "../../../data/ai/search-catalog-knowledge.js";
import { loadCatalogKnowledge } from "../load-catalog-knowledge.js";
import { embedCatalogContent } from "./embed-catalog-content.js";

export class KnowledgeSearchUnavailable extends Error {}

export async function searchCatalogKnowledgeService(
  db: Kysely<DB>,
  query: string,
  abortSignal?: AbortSignal,
): Promise<KnowledgeSearchResponse> {
  let vector: Awaited<ReturnType<typeof embedCatalogContent>>;

  try {
    vector = await embedCatalogContent({
      contentMarkdown: query,
      purpose: "search",
      abortSignal,
    });
  } catch {
    throw new KnowledgeSearchUnavailable();
  }

  abortSignal?.throwIfAborted();

  const results = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const knowledge = await loadCatalogKnowledge(trx);

      const eligible = new Map<
        string,
        Omit<KnowledgeSearchResult, "similarity">
      >(
        knowledge.entries.flatMap(({ listing, chunks }) =>
          chunks
            .filter((chunk) => chunk.status === "indexed" && !chunk.withdrawn)
            .map(
              (chunk) =>
                [
                  `${listing.kind}:${listing.id}:${chunk.key}`,
                  {
                    listing: {
                      id: listing.id,
                      kind: listing.kind,
                      name: listing.name,
                    },
                    key: chunk.key,
                    kind: chunk.kind,
                    contentMarkdown: chunk.contentMarkdown,
                    mediaUrl: chunk.mediaUrl,
                  },
                ] as const,
            ),
        ),
      );

      const ranked = await searchCatalogKnowledgeData(
        trx,
        vector.embedding,
        vector.model,
      );

      return ranked.rows
        .flatMap((row) => {
          const key = row.package_id
            ? `package:${row.package_id}:${row.chunk_key}`
            : `service:${row.service_id}:${row.chunk_key}`;
          const result = eligible.get(key);

          return result && Number.isFinite(row.similarity)
            ? [{ ...result, similarity: row.similarity }]
            : [];
        })
        .slice(0, KNOWLEDGE_SEARCH_LIMIT);
    });

  return { query, model: vector.model, results };
}
