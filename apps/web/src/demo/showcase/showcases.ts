import { photos } from "../catalog/photos";

/**
 * MOCK showcase data — local only, no API or database.
 *
 * The shapes mirror the eventual `ShowcaseRecord` / `ShowcaseMediaItem` contracts
 * so this module can be swapped for a real server loader without touching the
 * components. The cover is always an image (per the agreed design); videos live
 * in the gallery and carry a `poster` so the card renders even if the sample clip
 * can't be fetched in the viewer's environment.
 */

export type ShowcaseMediaKind = "image" | "video";

export type ShowcaseMediaItem = {
  id: string;
  kind: ShowcaseMediaKind;
  mimeType: string;
  url: string;
  /** Mock-only: poster frame for a video card. */
  poster?: string;
};

export type ShowcaseRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cover: ShowcaseMediaItem;
  media: ShowcaseMediaItem[];
};

const SAMPLE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

const image = (id: string, url: string): ShowcaseMediaItem => ({
  id,
  kind: "image",
  mimeType: "image/jpeg",
  url,
});

const video = (id: string, poster: string): ShowcaseMediaItem => ({
  id,
  kind: "video",
  mimeType: "video/mp4",
  url: SAMPLE_VIDEO,
  poster,
});

export const showcases: ShowcaseRecord[] = [
  {
    id: "sc-1",
    slug: "mara-and-liams-wedding",
    title: "Mara & Liam's Wedding",
    description:
      "A garden celebration in Tagaytay with a warm tent reception, string lights, and a long family-style dinner.",
    publishedAt: "2025-11-08T10:00:00Z",
    createdAt: "2025-11-08T10:00:00Z",
    updatedAt: "2025-11-09T08:00:00Z",
    cover: image("sc-1-cover", photos.wedding),
    media: [
      image("sc-1-1", photos.wedding),
      image("sc-1-2", photos.dinner),
      image("sc-1-3", photos.dessert),
      image("sc-1-4", photos.hero),
    ],
  },
  {
    id: "sc-2",
    slug: "amac-corporate-gala-2025",
    title: "AMAC Corporate Gala 2025",
    description:
      "A formal evening for 220 guests — plated dinner, a stage program, and a quiet lounge for late-night conversations.",
    publishedAt: "2025-10-20T10:00:00Z",
    createdAt: "2025-10-20T10:00:00Z",
    updatedAt: "2025-10-21T08:00:00Z",
    cover: image("sc-2-cover", photos.dinner),
    media: [
      image("sc-2-1", photos.dinner),
      image("sc-2-2", photos.hero),
      image("sc-2-3", photos.dessert),
      video("sc-2-4", photos.hero),
    ],
  },
  {
    id: "sc-3",
    slug: "the-vega-wedding",
    title: "The Vega Wedding",
    description:
      "A sunset ceremony on a Batangas cliffside, with candlelit tables and a dessert spread that ran late into the night.",
    publishedAt: "2025-09-14T10:00:00Z",
    createdAt: "2025-09-14T10:00:00Z",
    updatedAt: "2025-09-15T08:00:00Z",
    cover: image("sc-3-cover", photos.hero),
    media: [
      image("sc-3-1", photos.hero),
      image("sc-3-2", photos.wedding),
      image("sc-3-3", photos.dessert),
      image("sc-3-4", photos.dinner),
    ],
  },
  {
    id: "sc-4",
    slug: "sofias-debutante-dinner",
    title: "Sofia's Debutante Dinner",
    description:
      "An intimate eighteenth birthday with a pastel palette, a strings trio, and a family-style dessert table.",
    publishedAt: "2025-08-02T10:00:00Z",
    createdAt: "2025-08-02T10:00:00Z",
    updatedAt: "2025-08-03T08:00:00Z",
    cover: image("sc-4-cover", photos.dessert),
    media: [
      image("sc-4-1", photos.dessert),
      image("sc-4-2", photos.dinner),
      image("sc-4-3", photos.wedding),
    ],
  },
  {
    id: "sc-5",
    slug: "sunday-garden-brunch",
    title: "Sunday Garden Brunch",
    description:
      "A relaxed morning gathering under linen canopies — fresh tables, live acoustic sets, and a long coffee bar.",
    publishedAt: "2025-07-19T10:00:00Z",
    createdAt: "2025-07-19T10:00:00Z",
    updatedAt: "2025-07-20T08:00:00Z",
    cover: image("sc-5-cover", photos.wedding),
    media: [
      image("sc-5-1", photos.wedding),
      image("sc-5-2", photos.hero),
      image("sc-5-3", photos.dinner),
      video("sc-5-4", photos.dessert),
    ],
  },
  {
    id: "sc-6",
    slug: "annual-awards-night",
    title: "Annual Awards Night",
    description:
      "A black-tie recognition night with a plated three-course dinner, stage awards, and a closing toast.",
    publishedAt: "2025-06-11T10:00:00Z",
    createdAt: "2025-06-11T10:00:00Z",
    updatedAt: "2025-06-12T08:00:00Z",
    cover: image("sc-6-cover", photos.dinner),
    media: [
      image("sc-6-1", photos.dinner),
      image("sc-6-2", photos.dessert),
      image("sc-6-3", photos.hero),
      image("sc-6-4", photos.wedding),
    ],
  },
];

export function findShowcase(slug: string): ShowcaseRecord | null {
  return showcases.find((item) => item.slug === slug) ?? null;
}

export function featuredShowcases(limit = 5): ShowcaseRecord[] {
  return showcases.slice(0, limit);
}
