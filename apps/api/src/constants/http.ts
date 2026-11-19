import { MAX_MESSAGE_IMAGES } from "@event-management/contracts/limits/messages";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";

export const SMALL_JSON_BODY_LIMIT_BYTES = 16 * 1024;
export const CATALOG_JSON_BODY_LIMIT_BYTES = 3 * 1024 * 1024;

// A full item list is up to 100 descriptions of 4,000 characters, plus JSON.
export const QUOTATION_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

export function bookingBodyLimit(path: string) {
  if (/^\/(?:v1\/)?admin\/booking-requests\/[^/]+\/custom-package$/.test(path))
    return CATALOG_JSON_BODY_LIMIT_BYTES;

  return SMALL_JSON_BODY_LIMIT_BYTES;
}

export const MEDIA_UPLOAD_BODY_OVERHEAD_BYTES = 64 * 1024;

export const MESSAGE_UPLOAD_BODY_LIMIT_BYTES =
  MAX_MESSAGE_IMAGES * MAX_IMAGE_SIZE_BYTES + MEDIA_UPLOAD_BODY_OVERHEAD_BYTES;

export function messageBodyLimit(path: string, contentType?: string) {
  const send = /\/(?:conversation|conversations\/[^/]+)\/messages$/.test(path);

  return send && contentType?.toLowerCase().startsWith("multipart/form-data")
    ? MESSAGE_UPLOAD_BODY_LIMIT_BYTES
    : SMALL_JSON_BODY_LIMIT_BYTES;
}
