import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import type { DB } from "./types.js";

export async function seedSamplePackages(db: Transaction<DB>) {
  const samples = [
    {
      id: "a4e55db2-745b-4bdb-bf92-38e7d29261d1",
      name: "The Grand Celebration",
      guests: 150,
      price: 185000,
      photo: "wedding",
      heading: "An occasion to remember",
      text: "Gather your favorite people for a celebration filled with thoughtful details, beautiful food, and moments worth keeping.",
    },
    {
      id: "a4e55db2-745b-4bdb-bf92-38e7d29261d2",
      name: "The Intimate Gathering",
      guests: 50,
      price: 68000,
      photo: "dinner",
      heading: "Gather around the table",
      text: "A warm, welcoming experience for the people closest to you.",
    },
    {
      id: "a4e55db2-745b-4bdb-bf92-38e7d29261d3",
      name: "The Sweet Soirée",
      guests: 80,
      price: 95000,
      photo: "dessert",
      heading: "A little more to celebrate",
      text: "Make the occasion yours with a memorable gathering.",
    },
  ];
  let count = 0;
  for (const sample of samples) {
    const row = await db
      .insertInto("packages")
      .values({
        id: sample.id,
        name: sample.name,
        slug: catalogSlug(sample.name),
        description: `${sample.heading} ${sample.text}`,
        max_guests: sample.guests,
        price: sample.price,
      })
      .onConflict((c) => c.column("id").doNothing())
      .returning("id")
      .executeTakeFirst();
    if (!row) continue;
    const sectionId = randomUUID(),
      mediaId = randomUUID();
    await db
      .insertInto("media_assets")
      .values({
        id: mediaId,
        kind: "image",
        source: "sample",
        url: `/images/${sample.photo}.jpg`,
      })
      .execute();
    const canvas = [
      {
        id: sectionId,
        title: "",
        widgets: [
          {
            id: randomUUID(),
            type: "photo",
            x: 0,
            y: 0,
            w: 6,
            h: 6,
            markdown: "",
            mediaId,
            alt: "Sample event table setting",
            caption: "",
            autoplay: false,
          },
          {
            id: randomUUID(),
            type: "markdown",
            x: 6,
            y: 0,
            w: 6,
            h: 6,
            markdown: `## ${sample.heading}\n\n${sample.text}`,
            mediaId: null,
            alt: "",
            caption: "",
            autoplay: false,
          },
        ],
      },
    ];
    await db
      .updateTable("packages")
      .set({
        canvas: sql`${JSON.stringify(storedSectionsSchema.parse(canvas))}::jsonb`,
      })
      .where("id", "=", row.id)
      .execute();
    count++;
  }
  return count;
}
