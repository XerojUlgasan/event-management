import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { KnowledgeStatus } from "@event-management/contracts/catalog-knowledge";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { loadCatalogKnowledge } from "./load-catalog-knowledge.js";

type Kind = "package" | "service";
type Query = {
  limit: number;
  cursor?: string;
  search?: string;
  kind?: Kind;
  status?: KnowledgeStatus | "attention";
};
const positionSchema = z.object({
  name: z.string(),
  kind: z.enum(["package", "service"]),
  id: z.string(),
});
function compare(
  a: { name: string; kind: string; id: string },
  b: { name: string; kind: string; id: string },
) {
  return (
    a.name.localeCompare(b.name) ||
    a.kind.localeCompare(b.kind) ||
    a.id.localeCompare(b.id)
  );
}
export async function listCatalogKnowledgeService(
  db: Kysely<DB>,
  query: Query,
) {
  const search = (query.search ?? "").toLowerCase();
  const scope = JSON.stringify([
    "knowledge-list",
    search,
    query.kind ?? "",
    query.status ?? "",
  ]);
  const position = parsePageCursor(query.cursor, positionSchema, scope);
  const result = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute((trx) => loadCatalogKnowledge(trx));
  const filtered = result.entries
    .map((item) => item.listing)
    .filter(
      (item) =>
        (!query.kind || item.kind === query.kind) &&
        (!query.status ||
          (query.status === "attention"
            ? item.status !== "indexed"
            : item.status === query.status)) &&
        item.name.toLowerCase().includes(search),
    )
    .sort(compare);
  const remaining = position
    ? filtered.filter((item) => compare(item, position) > 0)
    : filtered;
  const listings = remaining.slice(0, query.limit);
  const last = listings.at(-1);
  const nextCursor =
    remaining.length > query.limit && last
      ? encodePageCursor(scope, {
          name: last.name,
          kind: last.kind,
          id: last.id,
        })
      : null;
  return {
    summary: result.summary,
    listings,
    filteredCount: filtered.length,
    nextCursor,
    checkedAt: new Date().toISOString(),
  };
}
