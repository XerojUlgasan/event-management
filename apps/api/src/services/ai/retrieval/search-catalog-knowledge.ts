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

      const results: KnowledgeSearchResult[] = [];
      const matchedListings = new Set<string>();

      for (const row of ranked.rows) {
        const listingKey = row.package_id
          ? `package:${row.package_id}`
          : `service:${row.service_id}`;
        const result = eligible.get(`${listingKey}:${row.chunk_key}`);

        if (
          !result ||
          !Number.isFinite(row.similarity) ||
          matchedListings.has(listingKey)
        )
          continue;

        matchedListings.add(listingKey);
        results.push({ ...result, similarity: row.similarity });

        if (results.length === KNOWLEDGE_SEARCH_LIMIT) break;
      }

      return results;
    });

  return { query, model: vector.model, results };
}
