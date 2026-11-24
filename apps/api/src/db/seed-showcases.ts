import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { sql, type Transaction } from "kysely";
import { replaceShowcaseGalleryData } from "../data/showcase-records/replace-showcase-gallery.js";
import { lockAndValidateShowcaseMedia } from "../services/showcase/validate-showcase-media.js";
import { seedAssetUpload } from "./seed/asset-upload.js";
import { scenarioId } from "./seed/context.js";
import type { DB } from "./types.js";

const samples = [
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37262",
    title: "Mara & Liam's Garden Wedding",
    description:
      "White flowers framed the garden aisle for Mara and Liam's late-afternoon vows. After the ceremony, guests followed the covered arcade to a long reception table, where low flowers left room for conversation across the table. A few sprigs from the bouquet carried the ceremony palette through to dinner.",
    cover: "garden-ceremony.jpg",
    gallery: [
      "garden-bouquet.jpg",
      "garden-reception.jpg",
      "garden-place-settings.jpg",
    ],
    publishedAt: new Date("2025-11-08T10:00:00Z"),
  },
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37263",
    title: "The Studio Sessions",
    description:
      "Local creative teams came together for an afternoon of short talks and audience-led discussion. A single stage and a shared screen kept the presentations easy to follow. Participants had time to write down ideas between sessions before the floor opened for questions.",
    cover: "studio-audience.jpg",
    gallery: ["studio-stage.jpg", "studio-notes.jpg", "studio-discussion.jpg"],
    publishedAt: new Date("2025-10-20T10:00:00Z"),
  },
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37264",
    title: "A Candlelit Anniversary Dinner",
    description:
      "Twenty-four guests marked an anniversary around one long table. Place cards brought both sides of the family together, while candlelight and hanging greenery softened the room. Small plates were served first so guests could settle in before the couple's toast.",
    cover: "anniversary-long-table.jpg",
    gallery: [
      "anniversary-dining-room.jpg",
      "anniversary-place-card.jpg",
      "anniversary-first-course.jpg",
    ],
    publishedAt: new Date("2025-09-14T10:00:00Z"),
  },
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37265",
    title: "Sofia's Eighteenth Birthday Dinner",
    description:
      "Sofia's family planned an eighteenth-birthday dinner with round tables and garden-style arrangements in a warm brick dining room. A table near the entrance held the evening's flowers and place details, while the open floor made it easy to move between family tables.",
    cover: "birthday-dining-room.jpg",
    gallery: ["birthday-round-table.jpg", "birthday-floral-detail.jpg"],
    publishedAt: null,
  },
];

/** Seed missing showcases and leave existing records and media untouched. */
export async function seedSampleShowcases(db: Transaction<DB>) {
  // The cover is required at insert time. Serialize seed runs before any upload.
  await sql`select pg_advisory_xact_lock(hashtextextended('seed:sample-showcases', 0))`.execute(
    db,
  );

  let count = 0;

  for (const sample of samples) {
    const slug = catalogSlug(sample.title);

    const existing = await db
      .selectFrom("showcase_records")
      .select("id")
      .where((eb) => eb.or([eb("id", "=", sample.id), eb("slug", "=", slug)]))
      .executeTakeFirst();

    if (existing) continue;

    const uploadPhoto = (file: string) =>
      seedAssetUpload(db, {
        file: `showcases/${file}`,
        id: scenarioId(`showcase-photo:${sample.id}:${file}`),
        createdBy: null,
      });

    const coverMediaId = await uploadPhoto(sample.cover);
    const timestamp = sample.publishedAt ?? new Date();
    const description = `Demo event. ${sample.description} Photography is illustrative.`;

    await db
      .insertInto("showcase_records")
      .values({
        id: sample.id,
        slug,
        title: sample.title,
        description,
        cover_media_id: coverMediaId,
        published_at: sample.publishedAt,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .execute();

    const mediaIds = [];

    for (const file of sample.gallery) mediaIds.push(await uploadPhoto(file));

    const invalid = await lockAndValidateShowcaseMedia(
      db,
      { title: sample.title, description, coverMediaId, mediaIds },
      sample.id,
    );

    if (invalid) throw new Error(`${sample.title}: ${invalid.message}`);

    await replaceShowcaseGalleryData(db, sample.id, mediaIds);
    count++;
  }

  return count;
}
