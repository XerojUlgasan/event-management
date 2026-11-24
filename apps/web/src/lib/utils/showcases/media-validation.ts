import { MAX_SHOWCASE_GALLERY } from "@event-management/contracts/limits/showcase";
import {
  validateImageFile,
  validateVideoFile,
} from "../catalog/media-validation";

/** Returns an error message string if the cover file is invalid. */
export function validateShowcaseCover(file: File): string | undefined {
  return validateImageFile(file);
}

/** Returns an error message string if the selected gallery files are invalid. */
export function validateShowcaseGallery(
  files: readonly File[],
  currentCount: number,
): string | undefined {
  const remaining = Math.max(0, MAX_SHOWCASE_GALLERY - currentCount);

  if (remaining === 0)
    return `The gallery already has ${MAX_SHOWCASE_GALLERY} items. Remove one before adding another.`;

  if (files.length > remaining)
    return `Choose up to ${remaining} more ${remaining === 1 ? "item" : "items"}. The gallery holds ${MAX_SHOWCASE_GALLERY}.`;

  for (const file of files) {
    const error = file.type.startsWith("video/")
      ? validateVideoFile(file)
      : validateImageFile(file);

    if (error) return `${file.name}: ${error}`;
  }
}
