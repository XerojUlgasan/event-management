import { randomUUID } from "node:crypto";
import type { Transaction } from "kysely";
import type { DB } from "./types.js";

export async function seedSamplePackages(db: Transaction<DB>) {
  const samples = [
    { id: "a4e55db2-745b-4bdb-bf92-38e7d29261d1", name: "The Grand Celebration", guests: 150, price: 185000, photo: "wedding", heading: "An occasion to remember", text: "Gather your favorite people for a celebration filled with thoughtful details, beautiful food, and moments worth keeping." },
    { id: "a4e55db2-745b-4bdb-bf92-38e7d29261d2", name: "The Intimate Gathering", guests: 50, price: 68000, photo: "dinner", heading: "Gather around the table", text: "A warm, welcoming experience for the people closest to you." },
    { id: "a4e55db2-745b-4bdb-bf92-38e7d29261d3", name: "The Sweet Soirée", guests: 80, price: 95000, photo: "dessert", heading: "A little more to celebrate", text: "Make the occasion yours with a memorable gathering." },
  ];
  let count = 0;
  for (const sample of samples) {
    const row = await db.insertInto("packages").values({ id: sample.id, name: sample.name, description: `${sample.heading} ${sample.text}`, max_guests: sample.guests, price: sample.price }).onConflict(c => c.column("id").doNothing()).returning("id").executeTakeFirst();
    if (!row) continue;
    const pageId = randomUUID(), sectionId = randomUUID(), mediaId = randomUUID();
    await db.insertInto("catalog_pages").values({ id: pageId, package_id: row.id }).execute();
    await db.insertInto("catalog_sections").values({ id: sectionId, page_id: pageId, title: "", sort_order: 0 }).execute();
    await db.insertInto("media_assets").values({ id: mediaId, kind: "image", source: "sample", url: `/images/${sample.photo}.jpg` }).execute();
    await db.insertInto("catalog_widgets").values([
      { section_id: sectionId, type: "photo", sort_order: 0, x: 0, y: 0, w: 6, h: 6, media_id: mediaId, alt: "Sample event table setting" },
      { section_id: sectionId, type: "markdown", sort_order: 1, x: 6, y: 0, w: 6, h: 6, markdown: `## ${sample.heading}\n\n${sample.text}` },
    ]).execute();
    count++;
  }
  return count;
}
