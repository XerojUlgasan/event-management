import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import {
  MAX_CATALOG_SECTIONS,
  MAX_WIDGET_MARKDOWN_LENGTH,
} from "@event-management/contracts/catalog";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { contentSchema } from "../src/controllers/packages/schemas.js";
import { curatedPackages } from "../src/db/seed/package-collection.js";

const assets = new URL("../src/db/seed/assets/", import.meta.url);

test("curated packages have ten unique listings with valid fixed prices and editorial sections", () => {
  assert.equal(curatedPackages.length, 10);
  assert.equal(new Set(curatedPackages.map(({ name }) => name)).size, 10);

  for (const entry of curatedPackages) {
    const { name, description, price, guests, intro, sections } = entry;
    assert.ok(price > 0 && Number.isSafeInteger(price), name);
    contentSchema.parse({
      name,
      description,
      price: { kind: "fixed", currency: "PHP", amountMinor: price * 100 },
      maxGuests: guests,
      sections: [],
    });

    assert.ok(description.trim(), name);
    assert.ok(intro.trim() && intro.length <= MAX_WIDGET_MARKDOWN_LENGTH, name);
    assert.ok(sections.length >= 3, name);
    assert.ok(sections.length + 1 <= MAX_CATALOG_SECTIONS, name);
    assert.equal(
      new Set(sections.map(({ title }) => title)).size,
      sections.length,
      name,
    );

    for (const { title, markdown } of sections) {
      assert.ok(title.trim() && title.length <= MAX_CATALOG_TEXT_LENGTH, name);
      assert.ok(
        markdown.trim() && markdown.length <= MAX_WIDGET_MARKDOWN_LENGTH,
        name,
      );
    }
  }
});

test("each curated package points to distinct credited local JPEGs", async () => {
  const folder = new URL("packages/", assets);
  const credits = await readFile(new URL("ATTRIBUTION.md", folder), "utf8");

  const creditRows = Array.from(
    credits.matchAll(
      /^\| \`([a-z0-9-]+\.jpg)\` \| \S[^|]+ \| \[(?:Pexels|Unsplash)\]\((https:\/\/[^\s)]+)\) \|$/gm,
    ),
    ([, filename, source]) => ({ filename, source }),
  );

  const creditFiles = new Set(creditRows.map(({ filename }) => filename));

  assert.equal(creditFiles.size, creditRows.length, "Repeated credited file");
  assert.equal(
    new Set(creditRows.map(({ source }) => source)).size,
    creditRows.length,
    "Repeated photo source",
  );

  const referenced = new Set<string>();
  const hashes = new Set<string>();

  for (const { name, images } of curatedPackages) {
    assert.ok(images.length >= 3, name);

    for (const { file, alt } of images) {
      assert.match(file, /^packages\/[a-z0-9-]+\.jpg$/);
      assert.ok(alt.trim() && alt.length <= MAX_CATALOG_TEXT_LENGTH, file);
      assert.ok(!referenced.has(file), `Repeated image path ${file}`);
      referenced.add(file);

      const filename = file.slice("packages/".length);
      assert.ok(creditFiles.has(filename), `Missing photo credit for ${file}`);

      const photo = await readFile(new URL(file, assets));
      assert.ok(photo.length <= MAX_IMAGE_SIZE_BYTES, file);
      assert.equal(photo.subarray(0, 3).toString("hex"), "ffd8ff", file);
      assert.equal(photo.subarray(-2).toString("hex"), "ffd9", file);

      const hash = createHash("sha256").update(photo).digest("hex");
      assert.ok(!hashes.has(hash), `Repeated image bytes in ${file}`);
      hashes.add(hash);
    }
  }

  const localPhotos = (await readdir(folder)).filter((file) =>
    file.endsWith(".jpg"),
  );

  assert.deepEqual(
    Array.from(referenced, (file) => file.slice("packages/".length)).sort(),
    localPhotos.sort(),
  );
});
