import { z } from "@hono/zod-openapi";
import {
  CATALOG_COLUMNS,
  MAX_CATALOG_SECTIONS,
  MAX_CATALOG_WIDGETS,
  MAX_PACKAGE_SERVICES,
  MAX_WIDGET_MARKDOWN_LENGTH,
} from "@event-management/contracts/catalog";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";

const text = z.string().trim().max(MAX_CATALOG_TEXT_LENGTH);
const sampleImages = new Set([
  "/images/wedding.jpg",
  "/images/dinner.jpg",
  "/images/dessert.jpg",
  "/images/hero.jpg",
]);
export const priceSchema = z.object({
  kind: z.literal("fixed"),
  currency: z.literal("PHP"),
  amountMinor: z.number().int().positive().max(2147483647),
});
const packagePriceSchema = priceSchema.refine(
  (price) => price.amountMinor % 100 === 0,
  "Package price must be a whole peso amount",
);
export const mediaSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(["image", "video"]),
    source: z.enum(["upload", "sample"]),
    url: z.string().max(2048),
    mimeType: z.string().max(100).optional(),
  })
  .strict()
  .superRefine((media, ctx) => {
    if (media.source === "upload" && !media.id)
      ctx.addIssue({
        code: "custom",
        message: "Choose an uploaded file",
        path: ["id"],
      });
    if (
      media.source === "sample" &&
      (media.kind !== "image" || !sampleImages.has(media.url))
    )
      ctx.addIssue({
        code: "custom",
        message: "Unknown sample photo",
        path: ["url"],
      });
  });
export const widgetSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["photo", "markdown", "video"]),
    x: z
      .number()
      .int()
      .min(0)
      .max(CATALOG_COLUMNS - 1),
    y: z.number().int().min(0).max(100000),
    w: z.number().int().min(1).max(CATALOG_COLUMNS),
    h: z.number().int().min(1).max(100),
    markdown: z.string().max(MAX_WIDGET_MARKDOWN_LENGTH),
    media: mediaSchema.nullable(),
    alt: text,
    caption: text,
    autoplay: z.boolean().default(false),
  })
  .strict()
  .superRefine((widget, ctx) => {
    if (widget.autoplay && widget.type !== "video")
      ctx.addIssue({
        code: "custom",
        message: "Autoplay is only available for video widgets",
        path: ["autoplay"],
      });
    if (widget.x + widget.w > CATALOG_COLUMNS)
      ctx.addIssue({
        code: "custom",
        message: "Widget exceeds the page width",
        path: ["w"],
      });
    if (widget.type === "markdown") {
      if (!widget.markdown.trim() || widget.media !== null)
        ctx.addIssue({
          code: "custom",
          message: "Markdown widgets require text and no media",
        });
    } else if (
      !widget.media ||
      widget.media.kind !== (widget.type === "photo" ? "image" : "video") ||
      widget.markdown !== ""
    )
      ctx.addIssue({
        code: "custom",
        message: "Media widget requires matching media and no Markdown",
      });
  });
export const sectionSchema = z
  .object({
    id: z.string().uuid(),
    title: text,
    widgets: z.array(widgetSchema).max(MAX_CATALOG_WIDGETS),
  })
  .strict();
export const sectionsSchema = z.array(sectionSchema).max(MAX_CATALOG_SECTIONS).superRefine((sections, ctx) => {
  const sectionIds = sections.map(section => section.id);
  const widgetIds = sections.flatMap(section => section.widgets.map(widget => widget.id));
  if (new Set(sectionIds).size !== sectionIds.length || new Set(widgetIds).size !== widgetIds.length)
    ctx.addIssue({ code: "custom", message: "Section and widget IDs must be unique" });
  if (widgetIds.length > MAX_CATALOG_WIDGETS)
    ctx.addIssue({ code: "custom", message: `Use at most ${MAX_CATALOG_WIDGETS} widgets` });
});
export const packageServiceSchema = z
  .object({
    serviceId: z.string().uuid(),
    role: z.enum(["included", "optional"]),
  })
  .strict();
export const packageServicesSchema = z
  .array(packageServiceSchema)
  .max(MAX_PACKAGE_SERVICES)
  .superRefine((services, ctx) => {
    if (new Set(services.map((service) => service.serviceId)).size !== services.length)
      ctx.addIssue({
        code: "custom",
        message: "Each service can only be added once",
      });
  });
export const contentSchema = z.object({
  name: text.min(1), description: text.optional(),
  maxGuests: z.number().int().positive().max(2147483647), price: packagePriceSchema,
  sections: sectionsSchema,
  services: packageServicesSchema.default([]),
}).strict();
export type Content = z.infer<typeof contentSchema>;
// Response schemas include the stored description and derived cover image.
export const packageServiceResponseSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string(),
  role: z.enum(["included", "optional"]),
  sortOrder: z.number().int(),
  archivedAt: z.string().nullable(),
});
export const publicSchema = z.object({
  name: z.string(),
  maxGuests: z.number(),
  price: priceSchema,
  sections: z.array(sectionSchema),
  services: z.array(packageServiceResponseSchema),
  id: z.string().uuid(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string(),
});
export const adminSchema = publicSchema;
export const errorSchema = z.object({ error: z.string() });
