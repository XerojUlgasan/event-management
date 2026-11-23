import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { randomUUID } from "node:crypto";
import type { Transaction } from "kysely";
import type { DB } from "./types.js";

/**
 * Seeds sample showcase records with published and draft states.
 * Uses fixed record IDs so the seed is idempotent — safe to run repeatedly.
 * Cover images reference the same sample photos used by the package seed.
 */
export async function seedSampleShowcases(db: Transaction<DB>) {
  const samples: {
    id: string;
    title: string;
    description: string;
    photo: "wedding" | "dinner" | "dessert" | "hero";
    galleryPhotos: ("wedding" | "dinner" | "dessert" | "hero")[];
    publishedAt: Date | null;
  }[] = [
    {
      id: "b5f66ec3-856c-5cec-cf03-49f8e3a37262",
      title: "Mara & Liam's Wedding",
      description:
        "A garden celebration in Tagaytay with a warm tent reception, string lights, and a long family-style dinner.",
      photo: "wedding",
      galleryPhotos: ["dinner", "dessert", "hero"],
      publishedAt: new Date("2025-11-08T10:00:00Z"),
    },
    {
      id: "b5f66ec3-856c-5cec-cf03-49f8e3a37263",
      title: "AMAC Corporate Gala 2025",
      description:
        "A formal evening for 220 guests — plated dinner, a stage program, and a quiet lounge for late-night conversations.",
      photo: "dinner",
      galleryPhotos: ["hero", "dessert"],
      publishedAt: new Date("2025-10-20T10:00:00Z"),
    },
    {
      id: "b5f66ec3-856c-5cec-cf03-49f8e3a37264",
      title: "The Vega Wedding",
      description:
        "A sunset ceremony on a Batangas cliffside, with candlelit tables and a dessert spread that ran late into the night.",
      photo: "hero",
      galleryPhotos: ["wedding", "dessert"],
      publishedAt: new Date("2025-09-14T10:00:00Z"),
    },
    {
      id: "b5f66ec3-856c-5cec-cf03-49f8e3a37265",
      title: "Sofia's Debutante Dinner",
      description:
        "An intimate eighteenth birthday with a pastel palette, a strings trio, and a family-style dessert table.",
      photo: "dessert",
      galleryPhotos: ["dinner", "wedding"],
      publishedAt: null, // draft
    },
  ];

  let count = 0;

  for (const sample of samples) {
    // Skip entirely if the record already exists — keeps the seed idempotent
    // and avoids inserting orphaned media_assets on repeated runs.
    const existing = await db
      .selectFrom("showcase_records")
      .select("id")
      .where("id", "=", sample.id)
      .executeTakeFirst();

    if (existing) continue;

    // Insert cover media asset.
    const coverId = randomUUID();
    await db
      .insertInto("media_assets")
      .values({
        id: coverId,
        kind: "image",
        source: "sample",
        url: `/images/${sample.photo}.jpg`,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();

    // Insert showcase record.
    await db
      .insertInto("showcase_records")
      .values({
        id: sample.id,
        slug: catalogSlug(sample.title),
        title: sample.title,
        description: sample.description,
        cover_media_id: coverId,
        preview_video_id: null,
        published_at: sample.publishedAt,
        created_at: sample.publishedAt ?? new Date(),
        updated_at: sample.publishedAt ?? new Date(),
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();

    // Insert gallery media and ordered link rows.
    for (const [index, photoName] of sample.galleryPhotos.entries()) {
      const mediaId = randomUUID();
      await db
        .insertInto("media_assets")
        .values({
          id: mediaId,
          kind: "image",
          source: "sample",
          url: `/images/${photoName}.jpg`,
        })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();

      await db
        .insertInto("showcase_record_media")
        .values({
          record_id: sample.id,
          media_id: mediaId,
          sort_order: index,
        })
        .onConflict((oc) =>
          oc.columns(["record_id", "media_id"]).doNothing(),
        )
        .execute();
    }

    count++;
  }

  return count;
}
