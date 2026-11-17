import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
  draftSectionsSchema,
  sectionsSchema,
  storedSectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import { contentSchema } from "../src/controllers/packages/schemas.js";

const markdown = () => ({
  id: randomUUID(),
  type: "markdown",
  x: 0,
  y: 0,
  w: 12,
  h: 1,
  markdown: "Hello",
  media: null,
  alt: "",
  caption: "",
  autoplay: false,
});
const photo = () => ({
  ...markdown(),
  type: "photo",
  markdown: "",
  media: { id: randomUUID(), kind: "image", source: "upload", url: "/file" },
});
const section = (widgets: unknown[] = [markdown()]) => ({
  id: randomUUID(),
  title: "  Title  ",
  widgets,
});

test("canvas request rules and defaults", () => {
  const widget = markdown();
  const parsed = sectionsSchema.parse([
    { ...section(), widgets: [{ ...widget, autoplay: undefined }] },
  ]);
  assert.equal(parsed[0].title, "Title");
  assert.equal(parsed[0].widgets[0].autoplay, false);
  assert.equal(sectionsSchema.safeParse([section([photo()])]).success, true);
  const invalid = [
    [section([{ ...widget, x: 11, w: 2 }])],
    [section([{ ...widget, y: 100001 }])],
    [section([{ ...widget, h: 101 }])],
    [section([{ ...widget, x: 0.5 }])],
    [section([{ ...widget, markdown: "  " }])],
    [section([{ ...widget, autoplay: true }])],
    [section([{ ...widget, extra: true }])],
    [
      section([
        {
          ...photo(),
          media: { kind: "image", source: "sample", url: "/wrong" },
        },
      ]),
    ],
    [
      section([
        {
          ...photo(),
          media: {
            kind: "video",
            source: "upload",
            id: randomUUID(),
            url: "/file",
          },
        },
      ]),
    ],
    [section([{ ...photo(), markdown: "text" }])],
    Array.from({ length: 21 }, () => section([])),
    [section(Array.from({ length: 101 }, markdown))],
    [
      section(Array.from({ length: 51 }, markdown)),
      section(Array.from({ length: 50 }, markdown)),
    ],
    [section([{ ...widget, id: "invalid" }])],
  ];
  for (const value of invalid)
    assert.equal(sectionsSchema.safeParse(value).success, false);
  assert.equal(
    sectionsSchema.safeParse([
      section([
        {
          ...photo(),
          media: { kind: "image", source: "sample", url: "/images/hero.jpg" },
        },
      ]),
    ]).success,
    true,
  );
  assert.equal(
    sectionsSchema.safeParse([
      section([
        {
          ...photo(),
          type: "video",
          autoplay: true,
          media: {
            kind: "video",
            source: "upload",
            id: randomUUID(),
            url: "/file",
          },
        },
      ]),
    ]).success,
    true,
  );
});

test("service widgets require a service and persist only the reference", () => {
  const widget = {
    ...markdown(),
    type: "service",
    markdown: "",
    serviceId: randomUUID(),
  };
  assert.equal(sectionsSchema.safeParse([section([widget])]).success, true);
  for (const bad of [
    { ...widget, serviceId: null },
    { ...widget, media: photo().media },
    { ...widget, markdown: "text" },
    { ...widget, autoplay: true },
    { ...markdown(), serviceId: widget.serviceId },
    {
      ...markdown(),
      service: {
        id: widget.serviceId,
        slug: "x",
        name: "x",
        description: "x",
        imageUrl: null,
      },
    },
  ])
    assert.equal(sectionsSchema.safeParse([section([bad])]).success, false);
  const { media: _media, ...rest } = widget;
  assert.equal(
    storedSectionsSchema.safeParse([section([{ ...rest, mediaId: null }])])
      .success,
    true,
  );
  assert.equal(
    storedSectionsSchema.safeParse([
      section([{ ...rest, mediaId: null, service: {} }]),
    ]).success,
    false,
  );
  assert.equal(
    storedSectionsSchema.safeParse([
      section([
        { ...rest, mediaId: null, serviceId: widget.serviceId.toUpperCase() },
      ]),
    ]).success,
    false,
  );
});

test("IDs are unique across sections and widgets", () => {
  const first = section([markdown()]);
  const widget = first.widgets[0] as ReturnType<typeof markdown>;
  assert.equal(
    sectionsSchema.safeParse([first, { ...section([]), id: first.id }]).success,
    false,
  );
  assert.equal(
    sectionsSchema.safeParse([first, section([{ ...widget, id: widget.id }])])
      .success,
    false,
  );
});

test("draft missing IDs require a corresponding pending widget", () => {
  const widget = photo();
  const document = [
    section([
      {
        ...widget,
        media: { kind: "image", source: "upload", url: "blob:pending" },
      },
    ]),
  ];
  assert.equal(sectionsSchema.safeParse(document).success, false);
  assert.equal(
    draftSectionsSchema(new Set()).safeParse(document).success,
    false,
  );
  assert.equal(
    draftSectionsSchema(new Set([widget.id])).safeParse(document).success,
    true,
  );
  assert.equal(
    draftSectionsSchema(new Set([widget.id])).safeParse([
      section([{ ...widget, x: 11, w: 2 }]),
    ]).success,
    false,
  );
});

test("stored canvases enforce the shared rules and canonical media IDs", () => {
  const widget = markdown();
  const stored = { ...widget, mediaId: null };
  const { media: _media, ...storedWidget } = stored;
  const mediaId = randomUUID();
  const storedPhoto = {
    ...storedWidget,
    id: randomUUID(),
    type: "photo",
    markdown: "",
    mediaId,
  };
  assert.equal(
    storedSectionsSchema.safeParse([section([storedWidget, storedPhoto])])
      .success,
    true,
  );
  for (const bad of [
    { ...storedPhoto, mediaId: mediaId.toUpperCase() },
    { ...storedPhoto, mediaId: null },
    { ...storedWidget, mediaId },
    { ...storedWidget, markdown: " " },
    { ...storedWidget, x: 11, w: 2 },
    { ...storedWidget, autoplay: true },
    { ...storedWidget, extra: true },
    { ...storedWidget, autoplay: undefined },
  ])
    assert.equal(
      storedSectionsSchema.safeParse([section([bad])]).success,
      false,
    );
  assert.equal(
    storedSectionsSchema.safeParse([
      section([storedWidget]),
      section([{ ...storedWidget, id: storedWidget.id }]),
    ]).success,
    false,
  );
  assert.equal(
    storedSectionsSchema.safeParse(
      Array.from({ length: 21 }, () => section([])),
    ).success,
    false,
  );
});

test("shared schema can generate an OpenAPI document", () => {
  const app = new OpenAPIHono();
  app.openapi(
    createRoute({
      method: "post",
      path: "/package",
      request: {
        body: { content: { "application/json": { schema: contentSchema } } },
      },
      responses: { 200: { description: "ok" } },
    }),
    (c) => c.body(null, 200),
  );
  const document = app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: { title: "test", version: "1" },
  });
  assert.ok(document.paths?.["/package"]?.post?.requestBody);
});
