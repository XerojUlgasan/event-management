import { z } from "zod";
import {
  CATALOG_COLUMNS,
  MAX_CATALOG_SECTIONS,
  MAX_CATALOG_WIDGETS,
  MAX_WIDGET_MARKDOWN_LENGTH,
} from "@event-management/contracts/catalog";
import {
  MAX_CATALOG_TEXT_LENGTH,
  MAX_CATALOG_WIDGET_ROWS,
  MAX_CATALOG_WIDGET_Y,
} from "@event-management/contracts/limits/catalog";

const text = z.string().trim().max(MAX_CATALOG_TEXT_LENGTH);
const sampleImages = new Set([
  "/images/wedding.jpg",
  "/images/dinner.jpg",
  "/images/dessert.jpg",
  "/images/hero.jpg",
]);
function createMediaSchema(allowMissingUploadId: boolean) {
  return z
    .object({
      id: z.string().uuid().optional(),
      kind: z.enum(["image", "video"]),
      source: z.enum(["upload", "sample"]),
      url: z.string().max(2048),
      mimeType: z.string().max(100).optional(),
    })
    .strict()
    .superRefine((media, ctx) => {
      if (media.source === "upload" && !media.id && !allowMissingUploadId)
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
}
export const mediaSchema = createMediaSchema(false);
function createWidgetSchema(pendingWidgetIds?: ReadonlySet<string>) {
  return z
    .object({
      id: z.string().uuid(),
      type: z.enum(["photo", "markdown", "video"]),
      x: z
        .number()
        .int()
        .min(0)
        .max(CATALOG_COLUMNS - 1),
      y: z.number().int().min(0).max(MAX_CATALOG_WIDGET_Y),
      w: z.number().int().min(1).max(CATALOG_COLUMNS),
      h: z.number().int().min(1).max(MAX_CATALOG_WIDGET_ROWS),
      markdown: z.string().max(MAX_WIDGET_MARKDOWN_LENGTH),
      media: createMediaSchema(Boolean(pendingWidgetIds)).nullable(),
      alt: text,
      caption: text,
      autoplay: z.boolean().default(false),
    })
    .strict()
    .superRefine((widget, ctx) => {
      if (
        pendingWidgetIds &&
        widget.media?.source === "upload" &&
        !widget.media.id &&
        !pendingWidgetIds.has(widget.id)
      )
        ctx.addIssue({
          code: "custom",
          message: "Choose an uploaded file",
          path: ["media", "id"],
        });
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
      } else if (!widget.media)
        ctx.addIssue({
          code: "custom",
          message: `Add a ${widget.type} to this widget before saving.`,
        });
      else if (
        widget.media.kind !== (widget.type === "photo" ? "image" : "video") ||
        widget.markdown !== ""
      )
        ctx.addIssue({
          code: "custom",
          message: "Media widget requires matching media and no Markdown",
        });
    });
}
export const widgetSchema = createWidgetSchema();
function createSectionSchema(pendingWidgetIds?: ReadonlySet<string>) {
  return z
    .object({
      id: z.string().uuid(),
      title: text,
      widgets: z
        .array(createWidgetSchema(pendingWidgetIds))
        .max(MAX_CATALOG_WIDGETS),
    })
    .strict();
}
export const sectionSchema = createSectionSchema();
function createSectionsSchema(pendingWidgetIds?: ReadonlySet<string>) {
  return z
    .array(createSectionSchema(pendingWidgetIds))
    .max(MAX_CATALOG_SECTIONS)
    .superRefine((sections, ctx) => {
      const sectionIds = sections.map((section) => section.id);
      const widgetIds = sections.flatMap((section) =>
        section.widgets.map((widget) => widget.id),
      );
      if (
        new Set(sectionIds).size !== sectionIds.length ||
        new Set(widgetIds).size !== widgetIds.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Section and widget IDs must be unique",
        });
      if (widgetIds.length > MAX_CATALOG_WIDGETS)
        ctx.addIssue({
          code: "custom",
          message: `Use at most ${MAX_CATALOG_WIDGETS} widgets`,
        });
    });
}
export const sectionsSchema = createSectionsSchema();
export const draftSectionsSchema = (pendingWidgetIds: ReadonlySet<string>) =>
  createSectionsSchema(pendingWidgetIds);

const storedWidgetSchema = z
  .object({
    id: widgetSchema.shape.id,
    type: widgetSchema.shape.type,
    x: widgetSchema.shape.x,
    y: widgetSchema.shape.y,
    w: widgetSchema.shape.w,
    h: widgetSchema.shape.h,
    markdown: widgetSchema.shape.markdown,
    mediaId: z
      .string()
      .uuid()
      .refine((id) => id === id.toLowerCase(), "Media ID must be canonical")
      .nullable(),
    alt: widgetSchema.shape.alt,
    caption: widgetSchema.shape.caption,
    autoplay: z.boolean(),
  })
  .strict();

export const storedSectionsSchema = z
  .array(
    z
      .object({
        id: sectionSchema.shape.id,
        title: sectionSchema.shape.title,
        widgets: z.array(storedWidgetSchema),
      })
      .strict(),
  )
  .superRefine((sections, ctx) => {
    const result = sectionsSchema.safeParse(
      sections.map((section) => ({
        ...section,
        widgets: section.widgets.map(({ mediaId, ...widget }) => ({
          ...widget,
          media: mediaId
            ? {
                id: mediaId,
                kind: widget.type === "video" ? "video" : "image",
                source: "upload",
                url: `/v1/catalog-media/${mediaId}`,
              }
            : null,
        })),
      })),
    );
    if (!result.success) {
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
    }
  });
