import { z } from "zod";
import {
  MAX_SHOWCASE_TITLE_LENGTH,
  MAX_SHOWCASE_DESCRIPTION_LENGTH,
  MAX_SHOWCASE_GALLERY,
} from "./limits/showcase.js";

// ── Shared field schemas ───────────────────────────────────────────────────

const title = z.string().trim().min(1).max(MAX_SHOWCASE_TITLE_LENGTH);
const description = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SHOWCASE_DESCRIPTION_LENGTH);
const uuid = z.string().uuid();
const mediaIds = z.array(uuid).max(MAX_SHOWCASE_GALLERY);

// ── Request schemas (used by both API validation and web forms) ────────────

/** Create — always produces a draft (no published flag on creation). */
export const createShowcaseRecordSchema = z
  .object({
    title,
    description,
    coverMediaId: uuid,
    mediaIds,
    previewVideoId: uuid.nullable().optional(),
  })
  .strict();

/** Update — same content fields plus optimistic-concurrency timestamp. */
export const updateShowcaseRecordSchema = z
  .object({
    title,
    description,
    coverMediaId: uuid,
    mediaIds,
    previewVideoId: uuid.nullable().optional(),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();

// ── Response types (web imports these as TypeScript types) ─────────────────

export type ShowcaseMediaItem = {
  id: string;
  kind: "image" | "video";
  mimeType: string;
  /** API-proxied URL: /v1/showcase-media/{id} */
  url: string;
};

/** Returned by both the public list/detail and admin endpoints.
 *  Admin-only reads simply include records with publishedAt = null. */
export type ShowcaseRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Media asset ID for the cover image. */
  coverMediaId: string;
  /** URL for the required cover image: /v1/showcase-media/{id} */
  coverUrl: string;
  /** MIME type of the cover asset, e.g. "image/jpeg", "image/png", "image/webp". */
  coverMimeType: string;
  /** Media asset ID for the optional hover-preview video, or null. */
  previewVideoId: string | null;
  /** URL for the optional hover-preview video, or null. */
  previewVideoUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: ShowcaseMediaItem[];
};

export type CreateShowcaseRecord = z.infer<typeof createShowcaseRecordSchema>;
export type UpdateShowcaseRecord = z.infer<typeof updateShowcaseRecordSchema>;
