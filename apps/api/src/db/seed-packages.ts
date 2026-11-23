import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import {
  buildCatalogCanvas,
  requireCatalogEditorial,
} from "./seed/curated-catalog.js";
import { packageEditorial } from "./seed/package-editorial.js";
import type { DB } from "./types.js";

export async function seedSamplePackages(db: Transaction<DB>) {
  const samples = [
    {
      id: "a4e55db2-745b-4bdb-bf92-38e7d29261d1",
      name: "The Grand Celebration",
      guests: 150,
      price: 185000,
      photo: "/images/wedding.jpg",
      alt: "Illustrative wedding reception setting",
      description:
        "A formal wedding reception for a large family gathering. Fictional demo concept.",
    },
    {
      id: "a4e55db2-745b-4bdb-bf92-38e7d29261d2",
      name: "The Intimate Gathering",
      guests: 50,
      price: 68000,
      photo: "/images/dinner.jpg",
      alt: "Illustrative dining table setting",
      description:
        "An intimate family dinner for a milestone celebration. Fictional demo concept.",
    },
    {
      id: "a4e55db2-745b-4bdb-bf92-38e7d29261d3",
      name: "The Sweet Soirée",
      guests: 80,
      price: 95000,
      photo: "/images/dessert.jpg",
      alt: "Illustrative dessert display",
      description:
        "A pastel birthday celebration with a dessert focal point. Fictional demo concept.",
    },
  ];
  let count = 0;

  for (const [index, sample] of samples.entries()) {
    const row = await db
      .insertInto("packages")
      .values({
        id: sample.id,
        name: sample.name,
        slug: catalogSlug(sample.name),
        description: sample.description,
        max_guests: sample.guests,
        price: sample.price,
      })
      .onConflict((c) => c.column("id").doNothing())
      .returning("id")
      .executeTakeFirst();

    if (!row) continue;

    const mediaId = randomUUID();
    await db
      .insertInto("media_assets")
      .values({
        id: mediaId,
        kind: "image",
        source: "sample",
        url: sample.photo,
      })
      .execute();

    const canvas = buildCatalogCanvas(
      { ...sample, ...requireCatalogEditorial(packageEditorial, sample.name) },
      mediaId,
      () => randomUUID(),
      index,
    );

    await db
      .updateTable("packages")
      .set({
        canvas: sql`${JSON.stringify(canvas)}::jsonb`,
        thumbnail_media_id: mediaId,
      })
      .where("id", "=", row.id)
      .execute();
    count++;
  }

  return count;
}
