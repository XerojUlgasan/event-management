import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { detectServiceImageType } from "./service-image-storage.js";

function storage() {
  const { R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Media storage is not configured");
  return { bucket: R2_BUCKET_NAME, client: new S3Client({ region: "auto", endpoint: R2_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } }) };
}
export function detectCatalogMediaType(bytes: Uint8Array) {
  const image = detectServiceImageType(bytes);
  if (image) return { kind: "image" as const, mimeType: image };
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString() === "ftyp") return { kind: "video" as const, mimeType: "video/mp4" };
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { kind: "video" as const, mimeType: "video/webm" };
  return null;
}
export async function putCatalogMedia(key: string, bytes: Uint8Array, contentType: string) {
  const { client, bucket } = storage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }));
}
export async function deleteCatalogMedia(key: string) {
  const { client, bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
export async function getCatalogMedia(key: string, range?: string) {
  const { client, bucket } = storage();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(range ? { Range: range } : {}) }));
}
