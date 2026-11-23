import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("showcase previews cap visible graphemes and thumbnails without limiting detail", async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), "clemora-showcase-ssr-"));
  const server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    esbuild: { jsx: "automatic" },
    logLevel: "silent",
  });
  t.after(async () => {
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  });
  const { ShowcaseExpanded } = await server.ssrLoadModule(
    "/src/components/public/site/ShowcaseExpanded.tsx",
  );
  const { PublicShowcaseDetail } = await server.ssrLoadModule(
    "/src/components/public/site/PublicShowcaseDetail.tsx",
  );

  const ending = "👩‍👩‍👧‍👦";
  const titlePrefix = "A".repeat(58) + ending;
  const descriptionPrefix = "B".repeat(158) + ending;

  const item = {
    slug: "garden-party",
    title: titlePrefix + " CD",
    description: descriptionPrefix + " EF",
    coverUrl: "/images/cover.jpg",
    media: Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      kind: "image",
      url: `/images/gallery-${index}.jpg`,
    })),
  };

  const preview = renderToStaticMarkup(
    createElement(ShowcaseExpanded, { item }),
  );
  assert(preview.includes(`>${titlePrefix}…</a>`));
  assert(preview.includes(`<p>${descriptionPrefix}…</p>`));
  assert(preview.includes('src="/images/cover.jpg"'));
  assert.equal(
    [...preview.matchAll(/class="showcase-gallery-thumbnail"/g)].length,
    3,
  );
  assert.match(preview, /gallery-2\.jpg[^]*>\+9<\/span>/);
  assert.match(
    preview,
    /class="showcase-gallery-preview" href="\/showcases\/garden-party"/,
  );
  assert(!preview.includes("/images/gallery-3.jpg"));

  const detail = renderToStaticMarkup(
    createElement(PublicShowcaseDetail, { item }),
  );
  assert(detail.includes(`<h1>${item.title}</h1>`));
  assert(detail.includes(`<p>${item.description}</p>`));
  assert.equal(
    [...detail.matchAll(/<figure class="showcase-gallery-item /g)].length,
    12,
  );
});
