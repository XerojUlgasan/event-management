import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import { listCanvasServicesData } from "../../data/catalog-canvas/catalog-canvas-queries.js";
import type { DB } from "../../db/types.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { loadCatalogKnowledge } from "./load-catalog-knowledge.js";

const includedServiceLine =
  /^Included service ID: ([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}|not specified)$/gm;

export async function getCatalogKnowledgeService(
  db: Kysely<DB>,
  owner: { kind: "package" | "service"; id: string },
  query: { limit: number; cursor?: string },
) {
  const scope = JSON.stringify(["knowledge-detail", owner.kind, owner.id]);
  const position = parsePageCursor(query.cursor, z.string(), scope);

  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const result = await loadCatalogKnowledge(trx, owner);
      const entry = result.entries[0];

      if (!entry) return null;

      const sorted = entry.chunks.sort((a, b) => a.key.localeCompare(b.key));

      const remaining = position
        ? sorted.filter((chunk) => chunk.key.localeCompare(position) > 0)
        : sorted;

      const page = remaining.slice(0, query.limit);
      const last = page.at(-1);
      const nextCursor =
        remaining.length > query.limit && last
          ? encodePageCursor(scope, last.key)
          : null;

      if (owner.kind !== "package")
        return { listing: entry.listing, chunks: page, nextCursor };

      const ids = new Set<string>();

      for (const chunk of page) {
        if (chunk.kind !== "text") continue;

        for (const [, id] of chunk.contentMarkdown.matchAll(
          includedServiceLine,
        ))
          if (id !== "not specified") ids.add(id.toLowerCase());
      }

      const services = new Map(
        (await listCanvasServicesData(trx, [...ids])).map(({ id, name }) => [
          id,
          name.trim().replace(/\s+/g, " "),
        ]),
      );

      // Present saved and pending text with readable labels without changing the
      // content used to assess embeddings.
      const chunks = page.map((chunk) =>
        chunk.kind === "text"
          ? {
              ...chunk,
              contentMarkdown: chunk.contentMarkdown.replace(
                includedServiceLine,
                (_, id: string) => {
                  const name = services.get(id.toLowerCase());

                  return name
                    ? "Included service: " +
                        name.replace(
                          /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g,
                          "\\$&",
                        )
                    : "Included service: Service details unavailable";
                },
              ),
            }
          : chunk,
      );

      return { listing: entry.listing, chunks, nextCursor };
    });
}
