import { randomUUID } from "node:crypto";
import { MAX_NEW_CATALOG_RECOMMENDATIONS } from "@event-management/contracts/messages";
import type { Kysely } from "kysely";
import { listTurnCatalogLookupsData } from "../../data/ai/list-turn-catalog-lookups.js";
import type { DB } from "../../db/types.js";
import { recommendationSearchResultsSchema } from "./catalog-recommendations.js";
import type { createAttachCatalogRecommendationsTool } from "./tools/attach-catalog-recommendations.js";

type AttachRecommendations = NonNullable<
  ReturnType<typeof createAttachCatalogRecommendationsTool>["execute"]
>;

type RecommendationSelection =
  Parameters<AttachRecommendations>[0]["items"][number];

const catalogLink =
  /(?<!!)\[([^\]\n]+)\]\((\/(?:packages|services)\/[^()\s]+)\)/gu;

export async function attachLinkedPhotoRecommendations({
  db,
  turnId,
  customerMessageId,
  reply,
  attach,
  signal,
}: {
  db: Kysely<DB>;
  turnId: string;
  customerMessageId: string;
  reply: string;
  attach: AttachRecommendations;
  signal: AbortSignal;
}) {
  const links = [...reply.matchAll(catalogLink)];

  if (!links.length) return reply;

  const lookups = await listTurnCatalogLookupsData(
    db,
    turnId,
    customerMessageId,
  );
  const photos = new Set<string>();
  const eligible = new Map<string, RecommendationSelection>();

  for (const { search_output } of lookups) {
    const parsed = recommendationSearchResultsSchema.safeParse(search_output);

    if (!parsed.success) continue;

    if (parsed.data.photoAttachmentId)
      photos.add(parsed.data.photoAttachmentId);

    for (const { type, id, url } of parsed.data.results)
      if (url) eligible.set(url, { catalogType: type, id });
  }

  if (photos.size !== 1) return reply;

  const selected = new Map<string, RecommendationSelection>();

  for (const [, , url] of links) {
    if (!url || selected.has(url)) continue;

    const item = eligible.get(url);

    if (item) selected.set(url, item);

    if (selected.size === MAX_NEW_CATALOG_RECOMMENDATIONS) break;
  }

  if (!selected.size) return reply;

  try {
    await attach(
      { items: [...selected.values()] },
      {
        toolCallId: `automatic-recommendations-${randomUUID()}`,
        messages: [],
        abortSignal: signal,
        context: {},
      },
    );

    return reply.replace(catalogLink, (link, label: string, url: string) =>
      selected.has(url) ? label : link,
    );
  } catch {
    // The turn owns persistence failures. A rejected attachment leaves the links.
    signal.throwIfAborted();
  }

  return reply;
}
