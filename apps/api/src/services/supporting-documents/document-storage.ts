import { createHash } from "node:crypto";
import { SUPPORTING_DOCUMENT_MAX_BYTES } from "@event-management/contracts/supporting-documents";
import {
  deleteCatalogMedia,
  getCatalogMedia,
  putCatalogMedia,
} from "../../utils/catalog-media-storage.js";

const bucket = "supporting-documents";

export const documentSha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

export const putSupportingDocument = (key: string, bytes: Uint8Array) =>
  putCatalogMedia(key, bytes, "application/pdf", { bucket });

export const deleteSupportingDocument = (key: string) =>
  deleteCatalogMedia(key, bucket);

export async function readSupportingDocument(key: string, signal: AbortSignal) {
  const stream = await getCatalogMedia(key, undefined, signal, bucket);
  let size = 0;

  const bounded = stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.length;

        if (size > SUPPORTING_DOCUMENT_MAX_BYTES) {
          controller.error(new Error("Stored PDF exceeds the upload limit"));

          return;
        }

        controller.enqueue(chunk);
      },
    }),
    { signal },
  );

  return new Uint8Array(await new Response(bounded).arrayBuffer());
}
