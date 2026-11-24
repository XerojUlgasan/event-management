import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { serviceInputSchema } from "../src/controllers/services/schemas.js";
import { curatedServices } from "../src/db/seed/service-collection.js";

const assetRoot = new URL("../src/db/seed/assets/", import.meta.url);

const serviceAssets = new URL("services/", assetRoot);

test("curated services have distinct listings, valid PHP terms and editorial copy", () => {
  assert.equal(curatedServices.length, 10);
  assert.equal(
    new Set(curatedServices.map(({ name }) => catalogSlug(name))).size,
    curatedServices.length,
  );

  const pricingModels = new Set<string>();

  for (const {
    name,
    description,
    rate,
    fixed,
    hours,
    intro,
    sections,
  } of curatedServices) {
    const result = serviceInputSchema.safeParse({
      name,
      description,
      hourlyRatePesos: rate,
      fixedPricePesos: fixed,
      includedHours: hours,
    });
    assert.ok(result.success, `${name}: ${result.error?.message}`);
    pricingModels.add(fixed === null ? "hourly" : "fixed");

    assert.ok(
      intro.trim().length > 0 && intro.length <= MAX_CATALOG_TEXT_LENGTH,
      name,
    );
    assert.ok(sections.length >= 3, name);
    assert.equal(
      new Set(sections.map(({ title }) => title)).size,
      sections.length,
      name,
    );

    for (const { title, markdown } of sections) {
      assert.ok(
        title.trim().length > 0 && title.length <= MAX_CATALOG_TEXT_LENGTH,
        name,
      );
      assert.ok(
        markdown.trim().length > 0 &&
          markdown.length <= MAX_CATALOG_TEXT_LENGTH,
        `${name} / ${title}`,
      );
    }
  }

  assert.deepEqual(pricingModels, new Set(["hourly", "fixed"]));
});

test("curated services reference distinct locally bundled JPEGs with photo credits", async () => {
  const files = new Set<string>();
  const hashes = new Set<string>();

  for (const { name, images } of curatedServices) {
    assert.ok(images.length >= 3, name);
    assert.equal(
      new Set(images.map(({ alt }) => alt)).size,
      images.length,
      name,
    );

    for (const { file, alt } of images) {
      assert.match(file, /^services\/[a-z0-9-]+\.jpg$/);
      assert.ok(
        alt.trim().length > 0 && alt.length <= MAX_CATALOG_TEXT_LENGTH,
        file,
      );
      assert.ok(!files.has(file), `Reused photo path: ${file}`);
      files.add(file);

      const bytes = await readFile(new URL(file, assetRoot));
      assert.deepEqual(
        bytes.subarray(0, 3),
        Buffer.from([0xff, 0xd8, 0xff]),
        file,
      );
      assert.deepEqual(bytes.subarray(-2), Buffer.from([0xff, 0xd9]), file);
      const hash = createHash("sha256").update(bytes).digest("hex");
      assert.ok(!hashes.has(hash), `Reused photo bytes: ${file}`);
      hashes.add(hash);
    }
  }

  const bundled = (await readdir(serviceAssets))
    .filter((file) => file.endsWith(".jpg"))
    .map((file) => `services/${file}`);

  assert.deepEqual(new Set(bundled), files);

  const credits = await readFile(
    new URL("ATTRIBUTION.md", serviceAssets),
    "utf8",
  );
  const rows = [
    ...credits.matchAll(
      /^\| `([\w-]+\.jpg)`\s*\| \[[^\]]+\]\((https:\/\/[^)]+)\)\s*\| (Pexels|Unsplash)\s*\|$/gm,
    ),
  ];
  assert.equal(rows.length, files.size);
  assert.deepEqual(new Set(rows.map(([, file]) => `services/${file}`)), files);
  assert.equal(new Set(rows.map(([, , source]) => source)).size, files.size);
});
