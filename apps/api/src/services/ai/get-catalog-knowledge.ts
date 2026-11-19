import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { loadCatalogKnowledge } from "./load-catalog-knowledge.js";

export async function getCatalogKnowledgeService(
  db: Kysely<DB>,
  owner: { kind: "package" | "service"; id: string },
  query: { limit: number; cursor?: string },
) {
  const scope = JSON.stringify(["knowledge-detail", owner.kind, owner.id]);
  const position = parsePageCursor(query.cursor, z.string(), scope);

  const result = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute((trx) => loadCatalogKnowledge(trx, owner));

  const entry = result.entries[0];

  if (!entry) return null;

  const sorted = entry.chunks.sort((a, b) => a.key.localeCompare(b.key));

  const remaining = position
    ? sorted.filter((chunk) => chunk.key.localeCompare(position) > 0)
    : sorted;

  const chunks = remaining.slice(0, query.limit);
  const last = chunks.at(-1);
  const nextCursor =
    remaining.length > query.limit && last
      ? encodePageCursor(scope, last.key)
      : null;

  return { listing: entry.listing, chunks, nextCursor };
}
