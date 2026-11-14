import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Vite processes the real TSX and its CSS imports, as the Astro SSR build does.
const root = fileURLToPath(new URL("../../", import.meta.url));
let server, cacheDir, canvas, publicDetails, publicPackage, ui;
before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "clemora-catalog-ssr-"));
  server = await createServer({
    root,
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    esbuild: { jsx: "automatic" },
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      external: ["@babel/runtime"],
    },
    logLevel: "silent",
  });
  canvas = await server.ssrLoadModule(
    "/src/components/catalog/CatalogContent.tsx",
  );
  publicDetails = await server.ssrLoadModule(
    "/src/components/public/catalog/PublicCatalogDetail.tsx",
  );
  publicPackage = await server.ssrLoadModule(
    "/src/components/public/catalog/PublicPackageDetail.tsx",
  );
  ui = await server.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/ui/src/organisms/CatalogCanvas.tsx",
          import.meta.url,
        ),
      ),
  );
});
after(async () => {
  try {
    await server?.close();
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  }
});
const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));
const video = (id, autoplay) => ({
  id,
  type: "video",
  x: 0,
  y: 5,
  w: 6,
  h: 5,
  markdown: "",
  media: { kind: "video", source: "upload", url: "/v1/catalog-media/video" },
  alt: "",
  caption: "Film caption",
  autoplay,
});
const photo = {
  id: "photo",
  type: "photo",
  x: 0,
  y: 0,
  w: 6,
  h: 5,
  markdown: "",
  media: { kind: "image", source: "sample", url: "/images/wedding.jpg" },
  alt: "Table setting",
  caption: "Photo caption",
  autoplay: false,
};
const markdown = {
  id: "markdown",
  type: "markdown",
  x: 6,
  y: 0,
  w: 6,
  h: 5,
  media: null,
  alt: "",
  caption: "",
  autoplay: false,
  markdown:
    "# Heading\n\n*italic* and **bold**\n\n- First item\n- Second item\n\n[Safe link](https://example.com)\n\n| Name | Value |\n| --- | --- |\n| One | Two |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))",
};
const sections = [
  {
    id: "section",
    title: "A section",
    widgets: [photo, markdown, video("on", true), video("off", false)],
  },
];
const packageItem = {
  name: "Celebration",
  description: "Package summary",
  maxGuests: 120,
  price: { kind: "fixed", currency: "PHP", amountMinor: 125000 },
  services: [
    { serviceId: "s1", name: "Catering", role: "included" },
    { serviceId: "s2", name: "Music", role: "optional" },
  ],
  sections,
  slug: "celebration",
};
const service = {
  name: "Catering",
  description: "Service **summary**",
  hourlyRatePesos: 321,
  sections,
};

test("public package renders the canonical canvas with the booking action", () => {
  const action = createElement(
    "a",
    { className: "button button-primary", href: "/login?book=celebration" },
    "Book now",
  );
  const actual = render(publicPackage.PublicPackageDetail, {
    item: packageItem,
  });
  assert.equal(
    actual,
    render(canvas.PackageCanvas, { item: packageItem, bookingAction: action }),
  );
  for (const value of [
    "Celebration",
    "Package summary",
    "Up to 120 guests",
    "Catering · Included",
    "Music · Optional",
    "Book now",
  ])
    assert.ok(actual.includes(value), value);
  assert.match(actual, /1,250/);
});
test("public service renders its canonical canvas and metadata", () => {
  const serviceHtml = render(publicDetails.PublicServiceDetail, {
    item: service,
  });
  assert.equal(serviceHtml, render(canvas.ServiceCanvas, { item: service }));
  assert.match(serviceHtml, /321/);
  assert.match(serviceHtml, /<strong>summary<\/strong>/);
});
test("SSR renders complete sanitized Markdown and media on every catalog", () => {
  for (const [component, item] of [
    [publicPackage.PublicPackageDetail, packageItem],
    [publicDetails.PublicServiceDetail, service],
  ]) {
    const html = render(component, { item });
    for (const pattern of [
      /<h1[^>]*>.*?Heading<\/h1>/,
      /<em>italic<\/em>/,
      /<strong>bold<\/strong>/,
      /<ul>/,
      /<li>First item<\/li>/,
      /href="https:\/\/example.com"/,
      /<table>/,
      /<td>Two<\/td>/,
      /alt="Table setting"/,
      /Photo caption/,
      /Film caption/,
    ])
      assert.match(html, pattern);
    assert.doesNotMatch(html, /<script|javascript:|onerror=/i);
    const videos = html.match(/<video\b[^>]*>/g) ?? [];
    assert.equal(videos.length, 2);
    assert.match(videos[0], /controls=""/);
    assert.match(videos[0], /autoPlay=""/);
    assert.match(videos[0], /muted=""/);
    assert.match(videos[0], /playsInline=""/);
    assert.match(videos[1], /controls=""/);
    assert.doesNotMatch(videos[1], /autoPlay=|muted=/);
    assert.match(videos[1], /playsInline=""/);
  }
});
test("editing media retains caption and suppresses autoplay without suppressing controls", () => {
  const html = render(ui.CatalogWidgetContent, {
    widget: video("on", true),
    editor: true,
  });
  assert.match(html, /controls=""/);
  assert.match(html, /playsInline=""/);
  assert.doesNotMatch(html, /autoPlay=|muted=/);
  assert.match(html, /Film caption/);
  const image = render(ui.CatalogWidgetContent, {
    widget: photo,
    editor: true,
  });
  assert.match(image, /alt="Table setting"/);
  assert.match(image, /Photo caption/);
});

test("private package canvas retains description while hiding services and booking action", () => {
  const html = render(canvas.PackageCanvas, {
    item: packageItem,
    hideServices: true,
  });
  assert.match(html, /Package summary/);
  assert.doesNotMatch(
    html,
    /Package services|Catering · Included|Music · Optional|Book now/,
  );
  assert.match(html, /Up to 120 guests/);
});

test("legacy null service rate renders safely", () => {
  const serviceHtml = render(publicDetails.PublicServiceDetail, {
    item: { ...service, hourlyRatePesos: null },
  });
  assert.match(serviceHtml, /Rate not set/);
});

test("empty media has meaningful fallback and Markdown requests light mode", () => {
  for (const [type, message] of [
    ["photo", "Add a photo"],
    ["video", "Add a video"],
  ]) {
    const html = render(ui.CatalogWidgetContent, {
      widget: { ...photo, type, media: null },
    });
    assert.ok(html.includes(message));
    assert.doesNotMatch(html, /<img|<video/);
  }
  const html = render(ui.CatalogMarkdown, { source: "**Light content**" });
  assert.match(html, /data-color-mode="light"/);
  assert.match(html, /<strong>Light content<\/strong>/);
});

test("an editor media chooser retains the shared caption", () => {
  const html = render(ui.CatalogWidgetContent, {
    widget: { ...photo, media: null },
    editor: true,
    mediaPlaceholder: createElement(
      "button",
      { type: "button", className: "ui-catalog-empty" },
      "Choose photo",
    ),
  });
  assert.match(html, /<button[^>]*>Choose photo<\/button>/);
  assert.match(html, /Photo caption/);
  assert.doesNotMatch(html, /<img/);
});
