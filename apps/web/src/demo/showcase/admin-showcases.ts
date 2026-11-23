/**
 * Admin mock data for the showcase management page.
 * Extends the public ShowcaseRecord shape with admin-only fields.
 * Swapped for a real API client when the backend is ready.
 */

import { photos } from "../catalog/photos";

export type ShowcaseMediaItemAdmin = {
  id: string;
  kind: "image" | "video";
  mimeType: string;
  url: string;
  poster?: string;
};

export type AdminShowcase = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover: ShowcaseMediaItemAdmin;
  media: ShowcaseMediaItemAdmin[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const img = (id: string, url: string): ShowcaseMediaItemAdmin => ({
  id,
  kind: "image",
  mimeType: "image/jpeg",
  url,
});

const SAMPLE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

const vid = (id: string, poster: string): ShowcaseMediaItemAdmin => ({
  id,
  kind: "video",
  mimeType: "video/mp4",
  url: SAMPLE_VIDEO,
  poster,
});

export const adminShowcases: AdminShowcase[] = [
  {
    id: "sc-1",
    slug: "mara-and-liams-wedding",
    title: "Mara & Liam's Wedding",
    description:
      "A garden celebration in Tagaytay with a warm tent reception, string lights, and a long family-style dinner.",
    cover: img("sc-1-cover", photos.wedding),
    media: [
      img("sc-1-1", photos.wedding),
      img("sc-1-2", photos.dinner),
      img("sc-1-3", photos.dessert),
      img("sc-1-4", photos.hero),
    ],
    publishedAt: "2025-11-08T10:00:00Z",
    createdAt: "2025-11-08T09:00:00Z",
    updatedAt: "2025-11-09T08:00:00Z",
  },
  {
    id: "sc-2",
    slug: "amac-corporate-gala-2025",
    title: "AMAC Corporate Gala 2025",
    description:
      "A formal evening for 220 guests — plated dinner, a stage program, and a quiet lounge for late-night conversations.",
    cover: img("sc-2-cover", photos.dinner),
    media: [
      img("sc-2-1", photos.dinner),
      img("sc-2-2", photos.hero),
      vid("sc-2-3", photos.hero),
    ],
    publishedAt: "2025-10-20T10:00:00Z",
    createdAt: "2025-10-20T09:00:00Z",
    updatedAt: "2025-10-21T08:00:00Z",
  },
  {
    id: "sc-3",
    slug: "the-vega-wedding",
    title: "The Vega Wedding",
    description:
      "A sunset ceremony on a Batangas cliffside, with candlelit tables and a dessert spread that ran late into the night.",
    cover: img("sc-3-cover", photos.hero),
    media: [img("sc-3-1", photos.hero), img("sc-3-2", photos.wedding)],
    publishedAt: "2025-09-14T10:00:00Z",
    createdAt: "2025-09-14T09:00:00Z",
    updatedAt: "2025-09-15T08:00:00Z",
  },
  {
    id: "sc-4",
    slug: "sofias-debutante-dinner",
    title: "Sofia's Debutante Dinner",
    description:
      "An intimate eighteenth birthday with a pastel palette, a strings trio, and a family-style dessert table.",
    cover: img("sc-4-cover", photos.dessert),
    media: [img("sc-4-1", photos.dessert), img("sc-4-2", photos.dinner)],
    publishedAt: null, // draft
    createdAt: "2025-08-02T09:00:00Z",
    updatedAt: "2025-08-03T08:00:00Z",
  },
  {
    id: "sc-5",
    slug: "sunday-garden-brunch",
    title: "Sunday Garden Brunch",
    description:
      "A relaxed morning gathering under linen canopies — fresh tables, live acoustic sets, and a long coffee bar.",
    cover: img("sc-5-cover", photos.wedding),
    media: [
      img("sc-5-1", photos.wedding),
      vid("sc-5-2", photos.dessert),
    ],
    publishedAt: null, // draft
    createdAt: "2025-07-19T09:00:00Z",
    updatedAt: "2025-07-20T08:00:00Z",
  },
  {
    id: "sc-6",
    slug: "annual-awards-night",
    title: "Annual Awards Night",
    description:
      "A black-tie recognition night with a plated three-course dinner, stage awards, and a closing toast.",
    cover: img("sc-6-cover", photos.dinner),
    media: [img("sc-6-1", photos.dinner), img("sc-6-2", photos.dessert)],
    publishedAt: "2025-06-11T10:00:00Z",
    createdAt: "2025-06-11T09:00:00Z",
    updatedAt: "2025-06-12T08:00:00Z",
  },
];
