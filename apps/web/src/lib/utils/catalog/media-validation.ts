import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Returns an error message string if the file is invalid, undefined if it passes. */
export function validateImageFile(file: File): string | undefined {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Choose a JPEG, PNG, or WebP image.";

  if (!file.size || file.size > MAX_IMAGE_SIZE_BYTES)
    return `Image must be ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MiB or smaller.`;
}
