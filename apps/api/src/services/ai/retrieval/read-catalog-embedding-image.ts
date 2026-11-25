import type { Selectable } from "kysely";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import type { MediaAssets } from "../../../db/types.js";
import {
  detectCatalogMediaType,
  getCatalogMedia,
} from "../../../utils/catalog-media-storage.js";
import { readSampleCatalogPhoto } from "../../../utils/sample-catalog-photos.js";

export async function readCatalogEmbeddingImage(
  asset: Selectable<MediaAssets>,
  abortSignal?: AbortSignal,
  readUpload: typeof getCatalogMedia = getCatalogMedia,
) {
  abortSignal?.throwIfAborted();

  if (asset.kind !== "image") throw new Error("Catalog photo is unavailable");

  let bytes: Uint8Array;

  if (asset.source === "sample" && asset.url) {
    bytes = await readSampleCatalogPhoto(asset.url);
  } else if (asset.source === "upload" && asset.storage_key) {
    const stream = await readUpload(asset.storage_key, undefined, abortSignal);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
      for (;;) {
        abortSignal?.throwIfAborted();
        const next = await reader.read();

        if (next.done) break;

        size += next.value.length;

        if (size > MAX_IMAGE_SIZE_BYTES)
          throw new Error("Catalog photo exceeds the image size limit");

        chunks.push(next.value);
      }

      bytes = Buffer.concat(chunks);
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } else throw new Error("Catalog photo is unavailable");

  return prepareCatalogEmbeddingImage(bytes, abortSignal);
}

export async function prepareCatalogEmbeddingImage(
  bytes: Uint8Array,
  abortSignal?: AbortSignal,
  webpFormat: "png" | "original" = "png",
) {
  abortSignal?.throwIfAborted();

  if (!bytes.length || bytes.length > MAX_IMAGE_SIZE_BYTES)
    throw new Error("Catalog photo exceeds the image size limit");

  const detected = detectCatalogMediaType(bytes);

  if (!detected || detected.kind !== "image")
    throw new Error("Catalog photo has an unsupported format");

  if (detected.mimeType !== "image/webp" || webpFormat === "original")
    return { bytes, mimeType: detected.mimeType };

  const { Image } = await import("imagescript");
  const image = await Image.decode(bytes, { maxPixels: 16_000_000 });

  // Keep the embedding request bounded without modifying the uploaded original.
  if (Math.max(image.width, image.height) > 2048)
    image.resize(
      image.width >= image.height ? { width: 2048 } : { height: 2048 },
    );

  const png = await image.encodePNG();

  if (png.length > MAX_IMAGE_SIZE_BYTES)
    throw new Error("Converted catalog photo exceeds the image size limit");

  abortSignal?.throwIfAborted();

  return { bytes: png, mimeType: "image/png" };
}
