import {
  catalogRecommendationsSchema,
  MAX_NEW_CATALOG_RECOMMENDATIONS,
  type CatalogRecommendation,
} from "@event-management/contracts/messages";
import { pesosToCentavos } from "@event-management/contracts/money";
import type { Kysely } from "kysely";
import { z } from "zod";
import { getPublicCatalogItemData } from "../../data/ai/get-public-catalog-item.js";
import { listTurnCatalogLookupsData } from "../../data/ai/list-turn-catalog-lookups.js";
import type { Database } from "../../data/catalog-canvas/catalog-canvas-types.js";
import type { DB } from "../../db/types.js";
import { canvasReference } from "../../utils/catalog-canvas.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";

const listingType = z.enum(["package", "service"]);

const selectionSchema = z.strictObject({
  catalogType: listingType,
  id: z.uuid(),
});

export const attachCatalogRecommendationsInputSchema = z.strictObject({
  items: z.array(selectionSchema).min(1).max(MAX_NEW_CATALOG_RECOMMENDATIONS),
});

const searchResultsSchema = z.object({
  results: z.array(z.object({ type: listingType, id: z.uuid() })),
});

type Selection = z.infer<typeof selectionSchema>;

const listingKey = (type: Selection["catalogType"], id: string) =>
  `${type}:${id.toLowerCase()}`;

async function readRecommendation(
  db: Database,
  selection: Selection,
): Promise<CatalogRecommendation | null> {
  const listing = await getPublicCatalogItemData(db, selection);

  if (!listing) return null;

  const reference = {
    ...canvasReference(listing),
    description: Array.from(listing.description).slice(0, 240).join(""),
  };

  if (listing.type === "service")
    return {
      ...reference,
      type: "service",
      fixedPricePesos: listing.fixed_price_pesos,
      hourlyRatePesos: listing.hourly_rate_pesos,
      includedHours: listing.included_hours,
    };

  const sections = await readCatalogSectionsService(db, {
    kind: "package",
    id: listing.id,
  });

  const inclusions = sections
    .flatMap(({ widgets }) => widgets)
    .flatMap((widget) =>
      widget.type === "service" && widget.service
        ? [
            {
              name: widget.service.name,
              includedHours: widget.serviceTerms?.includedHours ?? null,
              hourlyRatePesos: widget.serviceTerms?.hourlyRatePesos ?? null,
            },
          ]
        : [],
    )
    .slice(0, 6);

  return {
    ...reference,
    type: "package",
    price: {
      kind: "fixed",
      currency: "PHP",
      amountMinor: pesosToCentavos(listing.price),
    },
    maxGuests: listing.max_guests,
    inclusions,
  };
}

export async function buildCatalogRecommendations({
  db,
  turnId,
  customerMessageId,
  items,
}: {
  db: Kysely<DB>;
  turnId: string;
  customerMessageId: string;
  items: Selection[];
}) {
  const keys = items.map(({ catalogType, id }) => listingKey(catalogType, id));

  if (new Set(keys).size !== keys.length) return null;

  const lookups = await listTurnCatalogLookupsData(
    db,
    turnId,
    customerMessageId,
  );
  const eligible = new Set<string>();

  for (const lookup of lookups) {
    if (lookup.tool_name === "searchPublicCatalog") {
      const parsed = searchResultsSchema.safeParse(lookup.search_output);

      if (parsed.success)
        for (const { type, id } of parsed.data.results)
          eligible.add(listingKey(type, id));
    } else {
      const parsed = selectionSchema.passthrough().safeParse(lookup.input);

      if (parsed.success)
        eligible.add(listingKey(parsed.data.catalogType, parsed.data.id));
    }
  }

  if (!keys.every((key) => eligible.has(key))) return null;

  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const recommendations = [];

      for (const item of items) {
        const recommendation = await readRecommendation(trx, item);

        if (!recommendation) return null;

        recommendations.push(recommendation);
      }

      return catalogRecommendationsSchema.parse(recommendations);
    });
}
