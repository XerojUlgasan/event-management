export const SMALL_JSON_BODY_LIMIT_BYTES = 16 * 1024;
export const CATALOG_JSON_BODY_LIMIT_BYTES = 3 * 1024 * 1024;

// A full item list is up to 100 descriptions of 4,000 characters, plus JSON.
export const QUOTATION_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

// 40 turns × 2,000 chars each, plus JSON framing.
export const AI_CHAT_CLAIM_BODY_LIMIT_BYTES = 128 * 1024;

export function bookingBodyLimit(path: string) {
  if (/^\/(?:v1\/)?admin\/booking-requests\/[^/]+\/custom-package$/.test(path))
    return CATALOG_JSON_BODY_LIMIT_BYTES;
  return SMALL_JSON_BODY_LIMIT_BYTES;
}

export const MEDIA_UPLOAD_BODY_OVERHEAD_BYTES = 64 * 1024;
