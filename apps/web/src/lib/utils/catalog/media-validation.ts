import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

const mebibytes = (bytes: number) => bytes / 1024 / 1024;

/** Returns an error message string if the file is invalid, undefined if it passes. */
export function validateImageFile(file: File): string | undefined {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Choose a JPEG, PNG, or WebP image.";

  if (!file.size || file.size > MAX_IMAGE_SIZE_BYTES)
    return `Image must be ${mebibytes(MAX_IMAGE_SIZE_BYTES)} MiB or smaller.`;
}

/** Returns an error message string if the file is invalid, undefined if it passes. */
export function validateVideoFile(file: File): string | undefined {
  if (!(ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type))
    return "Choose an MP4 or WebM video.";

  if (!file.size || file.size > MAX_VIDEO_SIZE_BYTES)
    return `Video must be ${mebibytes(MAX_VIDEO_SIZE_BYTES)} MiB or smaller.`;
}
