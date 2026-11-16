import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  CatalogSection,
  CatalogWidget,
} from "@event-management/contracts/catalog";
import type { PackageServiceRow } from "../../src/data/packages/package-services.js";
import type { PrepareCatalogKnowledgeInput } from "../../src/services/ai/retrieval/prepare-catalog-knowledge.js";
import { prepareCatalogKnowledge } from "../../src/services/ai/retrieval/prepare-catalog-knowledge.js";

const packageRecord = {
  id: "package-id",
  name: "Garden celebration",
  description: "A small outdoor celebration.",
  price: 12500,
  max_guests: 80,
  package_type: "catalog",
  archived_at: null,
} satisfies Extract<
  PrepareCatalogKnowledgeInput,
  { kind: "package" }
>["record"];

const serviceRecord = {
  id: "service-id",
  name: "Live music",
  description: "A live music service.",
  hourly_rate_pesos: 900,
  fixed_price_pesos: null,
  included_hours: null,
  archived_at: null,
} satisfies Extract<
  PrepareCatalogKnowledgeInput,
  { kind: "service" }
>["record"];

function widget(
  type: CatalogWidget["type"],
  id: string,
  x: number,
  y: number,
  values: Partial<CatalogWidget> = {},
): CatalogWidget {
  return {
    id,
    type,
    x,
    y,
    w: 1,
    h: 1,
    markdown: "",
    media: null,
    alt: "",
    caption: "",
    autoplay: false,
    ...values,
  };
}

function section(
  title: string,
  widgets: CatalogWidget[],
  id = `section-${title}`,
): CatalogSection {
  return { id, title, widgets };
}

function markdownSource(chunk: { contentMarkdown: string }) {
  const marker = "\nMarkdown:\n";
  const markerIndex = chunk.contentMarkdown.indexOf(marker);
  assert.notEqual(markerIndex, -1);
  return chunk.contentMarkdown.slice(markerIndex + marker.length);
}

test("package overview uses peso units and ordered active service roles", () => {
  const services: PackageServiceRow[] = [
    {
      package_id: packageRecord.id,
      service_id: "optional-id",
      role: "optional",
      sort_order: 2,
      name: "Dessert table",
      archived_at: null,
    },
    {
      package_id: packageRecord.id,
      service_id: "archived-id",
      role: "included",
      sort_order: 0,
      name: "Archived service marker",
      archived_at: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      package_id: packageRecord.id,
      service_id: "included-id",
      role: "included",
      sort_order: 1,
      name: "Table styling",
      archived_at: null,
    },
  ];
  const [overview] = prepareCatalogKnowledge({
    kind: "package",
    record: packageRecord,
    sections: [],
    services,
  });

  assert.equal(overview?.chunkKey, "overview");
  assert.match(
    overview?.contentMarkdown ?? "",
    /Price: PHP 12500 per package\./,
  );
  assert.match(overview?.contentMarkdown ?? "", /Capacity: up to 80 guests\./);
  assert.match(
    overview?.contentMarkdown ?? "",
    /Included services: Table styling\./,
  );
  assert.match(
    overview?.contentMarkdown ?? "",
    /Optional services: Dessert table\./,
  );
  assert.doesNotMatch(
    overview?.contentMarkdown ?? "",
    /Archived service marker/,
  );
});

test("service overview distinguishes hourly pricing from included hours and extra time", () => {
  const hourly = prepareCatalogKnowledge({
    kind: "service",
    record: serviceRecord,
    sections: [],
  })[0];
  assert.match(
    hourly?.contentMarkdown ?? "",
    /Hourly rate: PHP 900 per hour\./,
  );
  assert.doesNotMatch(hourly?.contentMarkdown ?? "", /Fixed price/);

  const fixed = prepareCatalogKnowledge({
    kind: "service",
    record: {
      ...serviceRecord,
      hourly_rate_pesos: 750,
      fixed_price_pesos: 3000,
      included_hours: 4,
    },
    sections: [],
  })[0];
  assert.match(
    fixed?.contentMarkdown ?? "",
    /Fixed price: PHP 3000 for 4 included hours\./,
  );
  assert.match(
    fixed?.contentMarkdown ?? "",
    /Additional time: PHP 750 per hour\./,
  );
});

test("Markdown widgets follow section and y/x reading order with exact bounded Unicode slices", () => {
  const markdown = `🎉`.repeat(6_001) + "\n# Ending";
  const input: PrepareCatalogKnowledgeInput = {
    kind: "package",
    record: packageRecord,
    services: [],
    sections: [
      section("Reception", [
        widget("markdown", "later-row", 0, 4, { markdown: "Later row." }),
        widget("markdown", "right-column", 8, 0, { markdown: "Right column." }),
        widget("markdown", "long-copy", 0, 2, { markdown }),
      ]),
      section("Dinner", [
        widget("markdown", "next-section", 0, 0, { markdown: "Dinner copy." }),
      ]),
    ],
  };

  const chunks = prepareCatalogKnowledge(input);
  const markdownChunks = chunks.filter((chunk) =>
    chunk.chunkKey.startsWith("markdown:"),
  );
  assert.deepEqual(
    markdownChunks.map((chunk) => chunk.chunkKey),
    [
      "markdown:right-column:0",
      "markdown:long-copy:0",
      "markdown:long-copy:1",
      "markdown:later-row:0",
      "markdown:next-section:0",
    ],
  );

  const longChunks = markdownChunks.filter((chunk) =>
    chunk.chunkKey.startsWith("markdown:long-copy:"),
  );
  const sourceSlices = longChunks.map(markdownSource);
  assert.ok(sourceSlices.every((slice) => Array.from(slice).length <= 6_000));
  assert.equal(sourceSlices.join(""), markdown);
  assert.match(
    longChunks[0]?.contentMarkdown ?? "",
    /Catalog package: Garden celebration/,
  );
  assert.match(longChunks[0]?.contentMarkdown ?? "", /Section: Reception/);
  assert.match(
    markdownChunks.find((chunk) => chunk.chunkKey === "markdown:next-section:0")
      ?.contentMarkdown ?? "",
    /Section: Dinner/,
  );
  assert.ok(markdownChunks.every((chunk) => chunk.mediaId === null));
});

test("each sample or uploaded photo keeps its context and media reference while videos are skipped", () => {
  const chunks = prepareCatalogKnowledge({
    kind: "service",
    record: serviceRecord,
    sections: [
      section("Gallery", [
        widget("photo", "uploaded-photo", 0, 0, {
          media: {
            id: "uploaded-media-id",
            kind: "image",
            source: "upload",
            url: "/v1/catalog-media/uploaded-media-id",
            mimeType: "image/jpeg",
          },
          alt: "Musician at the garden",
          caption: "Ceremony performance",
        }),
        widget("photo", "sample-photo", 0, 2, {
          media: {
            id: "sample-media-id",
            kind: "image",
            source: "sample",
            url: "/images/wedding.jpg",
          },
          alt: "Garden reception",
          caption: "",
        }),
        widget("video", "video-widget", 0, 1, {
          media: {
            id: "video-media-id",
            kind: "video",
            source: "upload",
            url: "/v1/catalog-media/video-media-id",
            mimeType: "video/mp4",
          },
          caption: "VIDEO CAPTION MUST NOT BE INCLUDED",
        }),
      ]),
    ],
  });
  const photos = chunks.filter((chunk) => chunk.chunkKey.startsWith("photo:"));

  assert.deepEqual(
    photos.map(({ chunkKey, mediaId }) => ({ chunkKey, mediaId })),
    [
      { chunkKey: "photo:uploaded-photo", mediaId: "uploaded-media-id" },
      { chunkKey: "photo:sample-photo", mediaId: "sample-media-id" },
    ],
  );
  assert.match(photos[0]?.contentMarkdown ?? "", /Catalog service: Live music/);
  assert.match(photos[0]?.contentMarkdown ?? "", /Section: Gallery/);
  assert.match(
    photos[0]?.contentMarkdown ?? "",
    /Alt text: Musician at the garden/,
  );
  assert.match(
    photos[0]?.contentMarkdown ?? "",
    /Caption: Ceremony performance/,
  );
  assert.match(photos[1]?.contentMarkdown ?? "", /Alt text: Garden reception/);
  assert.doesNotMatch(photos[1]?.contentMarkdown ?? "", /Caption:/);
  assert.ok(
    photos.every(
      (chunk) =>
        !chunk.contentMarkdown.includes("/images/wedding.jpg") &&
        !chunk.contentMarkdown.includes("/v1/catalog-media/") &&
        !chunk.contentMarkdown.includes("VIDEO CAPTION MUST NOT BE INCLUDED"),
    ),
  );
  assert.ok(chunks.every((chunk) => chunk.chunkKey !== "photo:video-widget"));
});

test("custom packages and archived catalog listings produce no chunks", () => {
  const packageInput = {
    kind: "package" as const,
    record: packageRecord,
    sections: [
      section("Details", [
        widget("markdown", "details", 0, 0, { markdown: "Text" }),
      ]),
    ],
    services: [],
  };
  assert.deepEqual(
    prepareCatalogKnowledge({
      ...packageInput,
      record: { ...packageRecord, package_type: "custom" },
    }),
    [],
  );
  assert.deepEqual(
    prepareCatalogKnowledge({
      ...packageInput,
      record: { ...packageRecord, archived_at: new Date() },
    }),
    [],
  );
  assert.deepEqual(
    prepareCatalogKnowledge({
      kind: "service",
      record: { ...serviceRecord, archived_at: new Date() },
      sections: packageInput.sections,
    }),
    [],
  );
});

test("preparation leaves the source input unchanged", () => {
  const input: PrepareCatalogKnowledgeInput = {
    kind: "package",
    record: packageRecord,
    services: [],
    sections: [
      section("Details", [
        widget("markdown", "later", 0, 2, { markdown: "Later." }),
        widget("markdown", "first", 0, 0, { markdown: "First." }),
      ]),
    ],
  };
  const before = structuredClone(input);

  prepareCatalogKnowledge(input);

  assert.deepEqual(input, before);
});
