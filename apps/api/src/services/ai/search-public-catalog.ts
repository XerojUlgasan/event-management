import { z } from "@hono/zod-openapi";
import {
  MAX_CATALOG_FILTER_GUESTS,
  MAX_CATALOG_FILTER_PRICE_PESOS,
} from "@event-management/contracts/catalog-filters";
import { MAX_CURSOR_LENGTH } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { searchPublicCatalogData } from "../../data/ai/search-public-catalog.js";
import { searchCatalogKnowledgeData } from "../../data/ai/search-catalog-knowledge.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { loadCatalogKnowledge } from "./load-catalog-knowledge.js";
import { embedCatalogContent } from "./retrieval/embed-catalog-content.js";
import { prepareCatalogEmbeddingImage } from "./retrieval/read-catalog-embedding-image.js";
import { KnowledgeSearchUnavailable } from "./retrieval/search-catalog-knowledge.js";
import { catalogKnowledgeDigest } from "./catalog-knowledge-hash.js";

export const PUBLIC_CATALOG_SEARCH_PAGE_SIZE = 3;

export const searchPublicCatalogInputSchema = z
  .strictObject({
    catalogType: z.enum(["package", "service"]),
    query: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe(
        "Text search terms, or the customer's explicitly requested visual focus when a photo is selected.",
      )
      .optional(),
    photoAttachmentId: z
      .uuid()
      .toLowerCase()
      .describe(
        "One eligible chat attachment ID for an explicitly requested visual match.",
      )
      .optional(),
    minPricePesos: z
      .number()
      .int()
      .min(0)
      .max(MAX_CATALOG_FILTER_PRICE_PESOS)
      .optional(),
    maxPricePesos: z
      .number()
      .int()
      .min(0)
      .max(MAX_CATALOG_FILTER_PRICE_PESOS)
      .optional(),
    pax: z.number().int().positive().max(MAX_CATALOG_FILTER_GUESTS).optional(),
    pricingType: z.enum(["fixed", "hourly"]).optional(),
    cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.minPricePesos !== undefined &&
      input.maxPricePesos !== undefined &&
      input.minPricePesos > input.maxPricePesos
    )
      ctx.addIssue({
        code: "custom",
        message: "Minimum price cannot exceed maximum price",
      });

    if (input.catalogType === "package" && input.pricingType !== undefined)
      ctx.addIssue({
        code: "custom",
        message: "Pricing type applies only to services",
      });

    if (input.catalogType === "service" && input.pax !== undefined)
      ctx.addIssue({ code: "custom", message: "Pax applies only to packages" });

    if (
      input.catalogType === "service" &&
      input.pricingType === undefined &&
      (input.minPricePesos !== undefined || input.maxPricePesos !== undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "Service price filters require a pricing type",
      });
  });

export type SearchPublicCatalogInput = z.infer<
  typeof searchPublicCatalogInputSchema
>;

export type CatalogSearchPhotoReader = (
  id: string,
  abortSignal?: AbortSignal,
) => Promise<{ bytes: Uint8Array; mimeType: string } | null>;

export class CatalogSearchPhotoUnavailable extends Error {}

const positionSchema = z.strictObject({
  id: z.string().uuid(),
  score: z.number().nullable(),
  nativeWebp: z.literal(true).optional(),
});

const short = (text: string, limit: number) =>
  Array.from(text).slice(0, limit).join("");

export async function searchPublicCatalogService({
  db,
  input: rawInput,
  readPhoto,
  abortSignal,
}: {
  db: Kysely<DB>;
  input: SearchPublicCatalogInput;
  readPhoto?: CatalogSearchPhotoReader;
  abortSignal?: AbortSignal;
}) {
  const input = searchPublicCatalogInputSchema.parse(rawInput);
  const scope = `public-catalog-search-v1:${catalogKnowledgeDigest(
    JSON.stringify([
      "public-catalog-search-v1",
      input.catalogType,
      input.query ?? null,
      input.minPricePesos ?? null,
      input.maxPricePesos ?? null,
      input.pax ?? null,
      input.pricingType ?? null,
      ...(input.photoAttachmentId ? [input.photoAttachmentId] : []),
    ]),
  )}`;
  const position = parsePageCursor(input.cursor, positionSchema, scope);
  const usesEmbedding = !!(input.query || input.photoAttachmentId);

  if (
    position &&
    (usesEmbedding ? position.score === null : position.score !== null)
  )
    throw new Error("Invalid public catalog cursor");

  let vector: Awaited<ReturnType<typeof embedCatalogContent>> | undefined;

  abortSignal?.throwIfAborted();

  let image:
    Awaited<ReturnType<typeof prepareCatalogEmbeddingImage>> | undefined;

  if (input.photoAttachmentId) {
    const original = await readPhoto?.(input.photoAttachmentId, abortSignal);

    if (!original) throw new CatalogSearchPhotoUnavailable();

    try {
      // Older WebP result pages used a converted PNG. Keep their query vector
      // consistent with the score in their continuation cursor.
      image = await prepareCatalogEmbeddingImage(
        original.bytes,
        abortSignal,
        position && !position.nativeWebp ? "png" : "original",
      );
    } catch {
      abortSignal?.throwIfAborted();
      throw new CatalogSearchPhotoUnavailable();
    }
  }

  if (usesEmbedding) {
    try {
      vector = await embedCatalogContent({
        contentMarkdown: input.query,
        image,
        purpose: "search",
        abortSignal,
      });
    } catch {
      abortSignal?.throwIfAborted();
      throw new KnowledgeSearchUnavailable();
    }
  }

  abortSignal?.throwIfAborted();

  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const listings = await searchPublicCatalogData(trx, input);

      const eligible = new Map(
        listings.map((listing) => [listing.id, listing]),
      );

      const ranked = new Map<
        string,
        {
          score: number;
          evidence: {
            kind: "text" | "photo";
            excerpt: string;
            similarity?: number;
          };
        }
      >();

      if (vector) {
        const knowledge = await loadCatalogKnowledge(trx);

        const chunks = new Map(
          knowledge.entries
            .filter(
              ({ listing }) =>
                listing.kind === input.catalogType && eligible.has(listing.id),
            )
            .flatMap(({ listing, chunks }) =>
              chunks
                .filter(
                  (chunk) =>
                    chunk.status === "indexed" &&
                    !chunk.withdrawn &&
                    (!image || chunk.kind === "photo"),
                )
                .map((chunk) => [`${listing.id}:${chunk.key}`, chunk] as const),
            ),
        );

        const rows = await searchCatalogKnowledgeData(
          trx,
          vector.embedding,
          vector.model,
        );

        for (const row of rows.rows) {
          const id =
            input.catalogType === "package" ? row.package_id : row.service_id;

          if (!id || ranked.has(id) || !Number.isFinite(row.similarity))
            continue;

          const chunk = chunks.get(`${id}:${row.chunk_key}`);

          if (chunk)
            ranked.set(id, {
              score: row.similarity,
              evidence: {
                kind: chunk.kind,
                excerpt: short(chunk.contentMarkdown, 500),
                ...(image && { similarity: row.similarity }),
              },
            });
        }
      }

      const ordered = listings
        .flatMap((listing) => {
          const match = ranked.get(listing.id);

          if (vector && !match) return [];

          return [
            {
              listing,
              score: match?.score ?? null,
              evidence: match ? [match.evidence] : [],
            },
          ];
        })
        .sort(
          (a, b) =>
            (b.score ?? 0) - (a.score ?? 0) ||
            (a.listing.id < b.listing.id
              ? -1
              : a.listing.id > b.listing.id
                ? 1
                : 0),
        );

      const after = position
        ? ordered.filter((item) =>
            position.score !== null && item.score !== null
              ? item.score < position.score ||
                (item.score === position.score && item.listing.id > position.id)
              : item.listing.id > position.id,
          )
        : ordered;

      const page = after.slice(0, PUBLIC_CATALOG_SEARCH_PAGE_SIZE);
      const last = page.at(-1);

      return {
        ...(input.photoAttachmentId && {
          photoAttachmentId: input.photoAttachmentId,
        }),
        results: page.map(({ listing, evidence }) => ({
          id: listing.id,
          type: listing.type,
          name: listing.name,
          description: short(listing.description, 300),
          url: `/${listing.type === "package" ? "packages" : "services"}/${encodeURIComponent(listing.slug)}`,
          price: listing.price,
          capacity: listing.capacity,
          evidence,
        })),
        nextCursor:
          after.length > PUBLIC_CATALOG_SEARCH_PAGE_SIZE && last
            ? encodePageCursor(scope, {
                id: last.listing.id,
                score: last.score,
                ...(image?.mimeType === "image/webp"
                  ? { nativeWebp: true }
                  : {}),
              })
            : null,
      };
    });
}
