import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Config } from "./r2-client.js";

export async function getImageFromR2(key: string): Promise<Buffer | null> {
  const { client, bucket } = r2Config();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) return null;
    return Buffer.from(await object.Body.transformToByteArray());
  } catch (cause) {
    if ((cause as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw cause;
  } finally {
    client.destroy();
  }
}

export async function deleteImageFromR2(key: string): Promise<void> {
  const { client, bucket } = r2Config();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } finally {
    client.destroy();
  }
}

// Database deletion commits first so a rollback cannot leave a referenced image missing.
export async function cleanupImagesFromR2(keys: string[]): Promise<void> {
  for (const key of new Set(keys)) {
    try {
      await deleteImageFromR2(key);
    } catch (cause) {
      console.error("R2 image cleanup failed", {
        key,
        error: cause instanceof Error ? cause.name : "UnknownError",
        status: (cause as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode,
      });
    }
  }
}
