import { createHash, randomUUID } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import {
  MAX_MESSAGE_IMAGES,
  MAX_MESSAGE_IMAGE_PIXELS,
} from "@event-management/contracts/limits/messages";
import type { SavedMessageImage } from "../../data/messages/message-images.js";
import {
  detectCatalogMediaType,
  putCatalogMedia,
  deleteCatalogMedia,
} from "../../utils/catalog-media-storage.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createInterpretMessageImageTool } from "../ai/tools/interpret-message-image.js";
import { messageImageInterpretationSchema } from "@event-management/contracts/message-images";

export type CheckedMessageImage = {
  bytes: Uint8Array;
  mimeType: string;
  contentHash: string;
};
export async function checkMessageImages(
  files: File[],
): Promise<CheckedMessageImage[]> {
  if (files.length > MAX_MESSAGE_IMAGES)
    throw new HTTPException(400, {
      message: `Attach at most ${MAX_MESSAGE_IMAGES} images`,
    });
  const checked: CheckedMessageImage[] = [];
  for (const file of files) {
    if (!file.size || file.size > MAX_IMAGE_SIZE_BYTES)
      throw new HTTPException(400, {
        message: "Each image must be at most 10 MiB",
      });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectCatalogMediaType(bytes);
    if (
      !detected ||
      detected.kind !== "image" ||
      file.type !== detected.mimeType
    )
      throw new HTTPException(400, {
        message: "Images must be valid JPEG, PNG, or WebP files",
      });
    try {
      const { Image } = await import("imagescript");
      await Image.decode(bytes, { maxPixels: MAX_MESSAGE_IMAGE_PIXELS });
    } catch {
      throw new HTTPException(400, {
        message: `Image is invalid or exceeds ${MAX_MESSAGE_IMAGE_PIXELS / 1_000_000} megapixels`,
      });
    }
    checked.push({
      bytes,
      mimeType: detected.mimeType,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return checked;
}
export async function cleanupMessageImages(images: SavedMessageImage[]) {
  await Promise.all(
    images.map((image) =>
      deleteCatalogMedia(image.storage_key).catch(() => {
        console.warn("message-image", {
          outcome: "cleanup-failed",
          imageId: image.id,
        });
      }),
    ),
  );
}
export async function prepareMessageImages(
  db: Kysely<DB>,
  conversationId: string,
  checked: CheckedMessageImage[],
  signal?: AbortSignal,
) {
  if (!checked.length) return [];
  const deadline = AbortSignal.any([
    AbortSignal.timeout(60_000),
    ...(signal ? [signal] : []),
  ]);
  const saved: SavedMessageImage[] = [];
  const turnId = randomUUID();
  try {
    for (const [position, image] of checked.entries()) {
      deadline.throwIfAborted();
      const id = randomUUID();
      const imageTool = createInterpretMessageImageTool({
        db,
        conversationId,
        turnId,
        imageId: id,
        position,
        image,
      });
      if (!imageTool.execute) throw new Error("Image tool cannot execute");
      const interpretation = messageImageInterpretationSchema.parse(
        await imageTool.execute(
          {},
          { toolCallId: id, messages: [], abortSignal: deadline, context: {} },
        ),
      );
      const ext =
        image.mimeType === "image/jpeg"
          ? "jpg"
          : image.mimeType === "image/png"
            ? "png"
            : "webp";
      const record = {
        id,
        position,
        storage_key: `messages/${conversationId}/${id}.${ext}`,
        mime_type: image.mimeType,
        byte_size: image.bytes.length,
        content_hash: image.contentHash,
        interpretation,
      };
      // Include the attempted key because a storage response may be lost after writing.
      saved.push(record);
      await putCatalogMedia(record.storage_key, image.bytes, image.mimeType, {
        abortSignal: deadline,
      });
    }
    deadline.throwIfAborted();
    return saved;
  } catch {
    await cleanupMessageImages(saved);
    throw new HTTPException(502, {
      message:
        "Images could not be interpreted or saved. Your message was not sent. Please try again.",
    });
  }
}
