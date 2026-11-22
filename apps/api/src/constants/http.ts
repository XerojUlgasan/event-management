import { MAX_MESSAGE_IMAGES } from "@event-management/contracts/limits/messages";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { SUPPORTING_DOCUMENT_MAX_BYTES } from "@event-management/contracts/supporting-documents";

export const SMALL_JSON_BODY_LIMIT_BYTES = 16 * 1024;
export const BOOKING_CREATE_JSON_BODY_LIMIT_BYTES = 64 * 1024;
export const CATALOG_JSON_BODY_LIMIT_BYTES = 3 * 1024 * 1024;

// Bounded profile text and FAQs can exceed 1 MiB after JSON escaping.
export const BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

// A full item list is up to 100 descriptions of 4,000 characters, plus JSON.
export const QUOTATION_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

export function bookingBodyLimit(path: string) {
  if (/^\/(?:v1\/)?booking-requests$/.test(path))
    return BOOKING_CREATE_JSON_BODY_LIMIT_BYTES;

  if (
    /^\/(?:v1\/)?admin\/booking-requests\/[^/]+\/quotations\/send$/.test(path)
  )
    return QUOTATION_JSON_BODY_LIMIT_BYTES;

  if (/^\/(?:v1\/)?admin\/booking-requests\/[^/]+\/custom-package$/.test(path))
    return CATALOG_JSON_BODY_LIMIT_BYTES;

  return SMALL_JSON_BODY_LIMIT_BYTES;
}

export const MEDIA_UPLOAD_BODY_OVERHEAD_BYTES = 64 * 1024;

export const SUPPORTING_DOCUMENT_UPLOAD_BODY_LIMIT_BYTES =
  SUPPORTING_DOCUMENT_MAX_BYTES + MEDIA_UPLOAD_BODY_OVERHEAD_BYTES;

export const MESSAGE_UPLOAD_BODY_LIMIT_BYTES =
  MAX_MESSAGE_IMAGES * MAX_IMAGE_SIZE_BYTES + MEDIA_UPLOAD_BODY_OVERHEAD_BYTES;

export function messageBodyLimit(path: string, contentType?: string) {
  const send = /\/(?:conversation|conversations\/[^/]+)\/messages$/.test(path);

  return send && contentType?.toLowerCase().startsWith("multipart/form-data")
    ? MESSAGE_UPLOAD_BODY_LIMIT_BYTES
    : SMALL_JSON_BODY_LIMIT_BYTES;
}
