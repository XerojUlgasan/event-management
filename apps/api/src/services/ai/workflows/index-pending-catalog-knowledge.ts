import { z } from "@hono/zod-openapi";
import type { KnowledgeIndexResponse } from "@event-management/contracts/catalog-knowledge";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import { findNextCatalogKnowledgeOwnerData } from "../../../data/ai/find-next-catalog-knowledge-owner.js";
import {
  encodePageCursor,
  parsePageCursor,
} from "../../../utils/pagination.js";
import { loadCatalogKnowledge } from "../load-catalog-knowledge.js";
import { refreshCatalogEmbeddingsService } from "./refresh-catalog-embeddings.js";

const scope = "knowledge-index-pending";

const positionSchema = z.strictObject({
  kind: z.enum(["package", "service"]),
  id: z.uuid(),
  key: z.string().min(1).max(512).nullable(),
});

type Position = z.infer<typeof positionSchema>;

const empty = { embedded: 0, unchanged: 0, superseded: 0, failed: 0 };

export async function indexPendingCatalogKnowledgeService(
  db: Kysely<DB>,
  cursor: string | undefined,
  abortSignal: AbortSignal,
): Promise<KnowledgeIndexResponse> {
  const initial = parsePageCursor(cursor, positionSchema, scope);
  abortSignal.throwIfAborted();

  const selection = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      await sql`SET LOCAL statement_timeout = '10s'`.execute(trx);
      let position: Position | undefined = initial;

      for (let scanned = 0; scanned < 5; scanned++) {
        abortSignal.throwIfAborted();
        const owner = await findNextCatalogKnowledgeOwnerData(
          trx,
          position && {
            kind: position.kind,
            id: position.id,
            inclusive: position.key !== null,
          },
        );
        abortSignal.throwIfAborted();

        if (!owner) return { item: undefined, cursor: null };

        const { entries } = await loadCatalogKnowledge(trx, owner);
        abortSignal.throwIfAborted();
        const afterKey =
          position?.kind === owner.kind && position.id === owner.id
            ? position.key
            : null;

        const chunk = entries[0]?.chunks
          .filter(
            (chunk) =>
              (chunk.withdrawn || chunk.status !== "indexed") &&
              (afterKey === null || chunk.key.localeCompare(afterKey) > 0),
          )
          .sort((a, b) => a.key.localeCompare(b.key))[0];

        if (chunk)
          return {
            item: { owner, chunk },
            cursor: encodePageCursor(scope, { ...owner, key: chunk.key }),
          };

        position = { ...owner, key: null };
      }

      return {
        item: undefined,
        cursor: position ? encodePageCursor(scope, position) : null,
      };
    });

  abortSignal.throwIfAborted();

  if (!selection.item) return { ...empty, nextCursor: selection.cursor };

  const { owner, chunk } = selection.item;
  const result = await refreshCatalogEmbeddingsService({
    db,
    owner,
    chunkKeys: chunk.withdrawn ? [] : [chunk.key],
    abortSignal,
  });
  abortSignal.throwIfAborted();

  if (!chunk.withdrawn && !Object.values(result).some(Boolean))
    result.superseded++;

  return { ...result, nextCursor: selection.cursor };
}
