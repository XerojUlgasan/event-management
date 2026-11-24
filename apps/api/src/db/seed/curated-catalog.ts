import { CATALOG_COLUMNS } from "@event-management/contracts/catalog";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";

export type CatalogCopy = {
  name: string;
  description: string;
  intro: string;
  sections: readonly { title: string; markdown: string }[];
  images: readonly { file: string; alt: string }[];
};

const SEED_WIDGET_ROWS = 3;

type StoredWidget = ReturnType<
  typeof storedSectionsSchema.parse
>[number]["widgets"][number];

const openingLayouts: ReadonlyArray<{
  photoWidth: number;
  photoFirst: boolean;
}> = [
  { photoWidth: 11, photoFirst: true },
  { photoWidth: 10, photoFirst: false },
  { photoWidth: CATALOG_COLUMNS, photoFirst: true },
  { photoWidth: 12, photoFirst: true },
  { photoWidth: 9, photoFirst: true },
];

export function buildCatalogCanvas(
  copy: CatalogCopy,
  mediaIds: readonly string[],
  id: (part: string) => string,
  options: { index: number; title: string; relatedServiceId?: string },
) {
  const widget = (
    part: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => ({
    id: id(part),
    x,
    y,
    w,
    h,
    mediaId: null,
    markdown: "",
    alt: "",
    caption: "",
    autoplay: false,
  });

  const text = (
    part: string,
    markdown: string,
    x: number,
    w: number,
  ): StoredWidget => ({
    ...widget(part, x, 0, w, SEED_WIDGET_ROWS),
    type: "markdown",
    markdown,
  });

  const photo = (
    position: number,
    x: number,
    w: number,
    y = 0,
  ): StoredWidget => ({
    ...widget(`photo-${position}`, x, y, w, SEED_WIDGET_ROWS),
    type: "photo",
    mediaId: mediaIds[position],
    alt: copy.images[position].alt,
  });

  const section = (part: string, title: string, widgets: StoredWidget[]) => ({
    id: id(part),
    title,
    columns: CATALOG_COLUMNS,
    widgets,
  });

  const { photoWidth, photoFirst } =
    openingLayouts[options.index % openingLayouts.length];
  const stacked = photoWidth === CATALOG_COLUMNS;
  const introWidth = stacked ? CATALOG_COLUMNS : CATALOG_COLUMNS - photoWidth;
  const intro = text(
    "intro",
    copy.intro,
    photoFirst && !stacked ? photoWidth : 0,
    introWidth,
  );
  const lead = {
    ...photo(0, photoFirst || stacked ? 0 : introWidth, photoWidth),
    caption: "Illustrative photo",
  };

  if (stacked) intro.y = lead.h;

  const sections = [
    section(
      "section-intro",
      options.title,
      photoFirst ? [lead, intro] : [intro, lead],
    ),
    ...copy.sections.map(({ title, markdown }, index) => {
      const part = `editorial-${index}`;
      const photoIndex = index + 1;

      if (photoIndex >= mediaIds.length)
        return section(`section-${part}`, title, [
          text(part, markdown, 0, CATALOG_COLUMNS),
        ]);

      const detailFirst = (options.index + index) % 3 === 0;
      // Give longer copy more of the paired row, keeping the photo alongside it.
      const photoWidth =
        markdown.length > 300 ? 9 : (options.index + index) % 2 === 0 ? 10 : 11;
      const textWidth = CATALOG_COLUMNS - photoWidth;
      const detail = photo(photoIndex, detailFirst ? 0 : textWidth, photoWidth);
      const body = text(
        part,
        markdown,
        detailFirst ? photoWidth : 0,
        textWidth,
      );

      return section(
        `section-${part}`,
        title,
        detailFirst ? [detail, body] : [body, detail],
      );
    }),
  ];

  const firstGalleryPhoto = copy.sections.length + 1;

  const gallery = mediaIds
    .slice(firstGalleryPhoto)
    .map((_, index) =>
      photo(
        firstGalleryPhoto + index,
        (index % 2) * 12,
        12,
        Math.floor(index / 2) * SEED_WIDGET_ROWS,
      ),
    );

  if (gallery.length)
    sections.push(section("section-gallery", "More views", gallery));

  if (options.relatedServiceId) {
    const related: StoredWidget = {
      ...widget("related-service", 0, 0, 16, SEED_WIDGET_ROWS),
      type: "service",
      serviceId: options.relatedServiceId,
      caption: "Available as a separate service.",
    };
    sections.push(
      section("section-related", "Plan alongside this service", [related]),
    );
  }

  return storedSectionsSchema.parse(sections);
}
