import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { r2Config } from "./r2-client.js";

export type ImageCategory = "venues" | "services" | "packages";
export type ImageContentType = "image/jpeg" | "image/png";

export class InvalidImageError extends Error {}

export function imageObjectKey(category: ImageCategory, id: string, contentType: ImageContentType): string {
  if (!["venues", "services", "packages"].includes(category)) throw new Error("Invalid image category");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error("Invalid image ID");
  if (!["image/jpeg", "image/png"].includes(contentType)) throw new Error("Invalid image content type");
  return `${category}/${id}.${contentType === "image/jpeg" ? "jpg" : "png"}`;
}

export async function uploadImageToR2(category: ImageCategory, data: Buffer, contentType: ImageContentType, id = randomUUID()): Promise<string> {
  const key = imageObjectKey(category, id, contentType);
  if (!Buffer.isBuffer(data) || data.length === 0 || data.length > MAX_IMAGE_SIZE_BYTES || !["image/jpeg", "image/png"].includes(contentType)) {
    throw new InvalidImageError("Choose a JPEG or PNG image up to 10 MiB");
  }

  try {
    const decoder = sharp(data, { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await decoder.metadata();
    const format = contentType === "image/jpeg" ? "jpeg" : "png";
    if (metadata.format !== format) throw new Error("Image type mismatch");
    await decoder.stats();
  } catch {
    throw new InvalidImageError("Choose a valid JPEG or PNG image up to 10 MiB");
  }

  const { client, bucket } = r2Config();
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
  } finally {
    client.destroy();
  }
  return key;
}
