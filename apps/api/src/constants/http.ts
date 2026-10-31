import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";

export const SMALL_JSON_BODY_LIMIT_BYTES = 16 * 1024;
export const CATALOG_JSON_BODY_LIMIT_BYTES = 64 * 1024;
export const IMAGE_UPLOAD_BODY_LIMIT_BYTES = MAX_IMAGE_SIZE_BYTES + 64 * 1024;
