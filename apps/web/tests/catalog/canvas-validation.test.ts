import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogSection } from "@event-management/contracts/catalog";
import { validateCatalogCanvas } from "../../src/lib/utils/catalog/canvas-validation.ts";

const widgetId = "ad075be9-5b36-48e1-a419-97f2f516358c";
const sections: CatalogSection[] = [
  {
    id: "180eb8f2-2274-4b88-949f-2ade2fe76f31",
    title: "Photos",
    widgets: [
      {
        id: widgetId,
        type: "photo",
        x: 0,
        y: 0,
        w: 6,
        h: 5,
        markdown: "",
        media: { kind: "image", source: "upload", url: "blob:pending-photo" },
        alt: "",
        caption: "",
        autoplay: false,
      },
    ],
  },
];

test("pending media is valid only when its own widget has a selected file", () => {
  assert.match(
    validateCatalogCanvas(sections) ?? "",
    /Section 1, widget 1: Choose an uploaded file/,
  );
  assert.ok(validateCatalogCanvas(sections, new Set(["another-widget"])));
  assert.equal(validateCatalogCanvas(sections, new Set([widgetId])), undefined);
  const saved = structuredClone(sections);
  assert.ok(saved[0].widgets[0].media);
  saved[0].widgets[0].media.id = "d30cfc22-086f-4d11-b97a-c6acc9668228";
  assert.equal(validateCatalogCanvas(saved), undefined);
});

test("canvas errors identify the affected section and widget before upload", () => {
  const invalid = structuredClone(sections);
  invalid[0].widgets[0].x = 10;
  assert.match(
    validateCatalogCanvas(invalid, new Set([widgetId])) ?? "",
    /Section 1, widget 1: Widget exceeds the page width/,
  );
});

test("canvas checks reject incomplete content and duplicate IDs", () => {
  const emptyPhoto = structuredClone(sections);
  emptyPhoto[0].widgets[0].media = null;
  assert.match(
    validateCatalogCanvas(emptyPhoto) ?? "",
    /Section 1, widget 1: Add a photo to this widget before saving/,
  );
  const markdown = structuredClone(sections);
  markdown[0].widgets[0] = {
    ...markdown[0].widgets[0],
    type: "markdown",
    media: null,
    markdown: "   ",
  };
  assert.match(
    validateCatalogCanvas(markdown) ?? "",
    /Markdown widgets require text/,
  );
  markdown[0].widgets[0].markdown = "Details";
  assert.equal(validateCatalogCanvas(markdown), undefined);
  markdown.push(structuredClone(markdown[0]));
  assert.match(validateCatalogCanvas(markdown) ?? "", /IDs must be unique/);
});
