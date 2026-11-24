import { createHash } from "node:crypto";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { MAX_MESSAGE_IMAGE_PIXELS } from "@event-management/contracts/limits/messages";
import {
  detectCatalogMediaType,
  getCatalogMedia,
} from "../../utils/catalog-media-storage.js";
import { MessageProcessingError } from "./message-processing-error.js";

export async function readValidatedMessageImage(
  image: {
    storage_key: string;
    mime_type: string;
    byte_size: number;
    content_hash: string;
  },
  signal: AbortSignal,
) {
  signal.throwIfAborted();

  if (image.byte_size <= 0 || image.byte_size > MAX_IMAGE_SIZE_BYTES)
    throw new MessageProcessingError("invalid_image");

  const stream = await getCatalogMedia(image.storage_key, undefined, signal);
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();

      if (part.done) break;

      size += part.value.length;

      if (size > image.byte_size)
        throw new MessageProcessingError("invalid_image");

      parts.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  signal.throwIfAborted();
  const bytes = Buffer.concat(parts);
  const detected = detectCatalogMediaType(bytes);

  if (
    size !== image.byte_size ||
    detected?.kind !== "image" ||
    detected.mimeType !== image.mime_type ||
    createHash("sha256").update(bytes).digest("hex") !== image.content_hash
  )
    throw new MessageProcessingError("invalid_image");

  try {
    const { Image } = await import("imagescript");
    await Image.decode(bytes, { maxPixels: MAX_MESSAGE_IMAGE_PIXELS });
  } catch {
    throw new MessageProcessingError("invalid_image");
  }

  signal.throwIfAborted();

  return { bytes, mimeType: detected.mimeType };
}
