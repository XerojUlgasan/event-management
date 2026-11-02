import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function storage() {
  const { R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Service image storage is not configured");
  return { bucket: R2_BUCKET_NAME, client: new S3Client({ region: "auto", endpoint: R2_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } }) };
}
const key = (id: string) => `service-images/${id}`;
export async function putServiceImage(id: string, bytes: Uint8Array, contentType: string) {
  const { client, bucket } = storage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key(id), Body: bytes, ContentType: contentType }));
}
export async function deleteServiceImage(id: string) {
  const { client, bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key(id) }));
}
export async function getServiceImage(id: string) {
  const { client, bucket } = storage();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key(id) }));
}
export function detectServiceImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}
