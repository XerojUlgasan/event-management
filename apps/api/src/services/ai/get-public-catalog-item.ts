import { MAX_CURSOR_LENGTH } from "@event-management/contracts/pagination";
import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import { HTTPException } from "hono/http-exception";
import type { DB } from "../../db/types.js";
import {
  getPublicCatalogItemData,
  listPublicLinkedPackageIdsData,
} from "../../data/ai/get-public-catalog-item.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";
import { catalogKnowledgeDigest } from "./catalog-knowledge-hash.js";

export const getPublicCatalogItemInputSchema = z.strictObject({
  catalogType: z.enum(["package", "service"]),
  id: z.string().uuid(),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
});
type Input = z.infer<typeof getPublicCatalogItemInputSchema>;
export class PublicCatalogItemNotFound extends Error {
  constructor() {
    super("Public catalog item not found");
  }
}

// At worst JSON escapes each code point as six ASCII bytes. This leaves ample
// space under the 32 KiB serialized audit budget, even for control characters.
const PAGE_CODE_POINTS = 4000;
const positionSchema = z.strictObject({ offset: z.number().int().positive() });
const link = (type: "package" | "service", slug: string) =>
  `/${type === "package" ? "packages" : "services"}/${encodeURIComponent(slug)}`;

export async function getPublicCatalogItemService({
  db,
  input: rawInput,
  abortSignal,
}: {
  db: Kysely<DB>;
  input: Input;
  abortSignal?: AbortSignal;
}): Promise<{ markdown: string; nextCursor: string | null }> {
  const input = getPublicCatalogItemInputSchema.parse(rawInput);
  abortSignal?.throwIfAborted();
  const document = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const item = await getPublicCatalogItemData(trx, input);
      if (!item) throw new PublicCatalogItemNotFound();
      const sections = await readCatalogSectionsService(trx, {
        kind: input.catalogType,
        id: item.id,
      });
      const packageIds = [
        ...new Set(
          sections.flatMap((s) =>
            s.widgets.flatMap((w) =>
              w.type === "package" && w.packageId ? [w.packageId] : [],
            ),
          ),
        ),
      ];
      const publicPackages = await listPublicLinkedPackageIdsData(
        trx,
        packageIds,
      );
      const lines = [
        `# ${item.name}`,
        `Type: ${item.type}`,
        `ID: ${item.id}`,
        `URL: ${link(item.type, item.slug)}`,
        `Updated at: ${new Date(item.updated_at).toISOString()}`,
        `Description: ${item.description}`,
        ...(item.type === "package"
          ? [
              `Price: PHP ${item.price} per package`,
              `Capacity: ${item.max_guests} guests`,
            ]
          : item.fixed_price_pesos !== null
            ? [
                `Price: PHP ${item.fixed_price_pesos} fixed`,
                `Included hours: ${item.included_hours}`,
                `Additional hourly rate: PHP ${item.hourly_rate_pesos} per hour`,
              ]
            : [`Price: PHP ${item.hourly_rate_pesos} per hour`]),
        "",
        "## Canvas",
      ];
      for (const section of sections) {
        lines.push("", `### ${section.title}`);
        const widgets = section.widgets
          .map((widget, index) => ({ widget, index }))
          .sort(
            (a, b) =>
              a.widget.y - b.widget.y ||
              a.widget.x - b.widget.x ||
              a.index - b.index,
          );
        for (const { widget } of widgets) {
          if (widget.type === "markdown") lines.push("", widget.markdown);
          else if (widget.type === "photo" || widget.type === "video") {
            if (widget.media)
              lines.push(
                "",
                `${widget.type === "photo" ? "Photo" : "Video"}: ${widget.media.url}`,
                `Alt: ${widget.alt}`,
                `Caption: ${widget.caption}`,
              );
          } else {
            const reference =
              widget.type === "package" ? widget.package : widget.service;
            if (
              !reference ||
              (widget.type === "package" && !publicPackages.has(reference.id))
            )
              continue;
            lines.push(
              "",
              `Linked ${widget.type}: ${reference.name}`,
              `ID: ${reference.id}`,
              `Type: ${widget.type}`,
              `URL: ${link(widget.type, reference.slug)}`,
              `Caption: ${widget.caption}`,
            );
          }
        }
      }
      return lines.join("\n");
    });
  abortSignal?.throwIfAborted();
  const scope = `public-catalog-item-v1:${catalogKnowledgeDigest(JSON.stringify([input.catalogType, input.id.toLowerCase(), document]))}`;
  const position = parsePageCursor(input.cursor, positionSchema, scope);
  const chars = Array.from(document);
  const offset = position?.offset ?? 0;
  if (offset >= chars.length || offset % PAGE_CODE_POINTS !== 0)
    throw new HTTPException(400, {
      message: "Invalid pagination cursor. Start again from the first page.",
    });
  const end = Math.min(offset + PAGE_CODE_POINTS, chars.length);
  const nextCursor =
    end < chars.length ? encodePageCursor(scope, { offset: end }) : null;
  const markdown = `${offset ? `Continuation of ${input.catalogType} ${input.id} (offset ${offset}):\n\n` : ""}${chars.slice(offset, end).join("")}\n\n---\nComplete: ${nextCursor === null}${nextCursor ? `\nNext cursor: ${nextCursor}` : ""}`;
  const result = { markdown, nextCursor };
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf8") > 32 * 1024)
    throw new Error("Public catalog item page exceeds audit budget");
  abortSignal?.throwIfAborted();
  return result;
}
