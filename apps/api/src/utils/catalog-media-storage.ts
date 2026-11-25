import { getR2Storage } from "./r2-storage.js";

export class CatalogMediaNotFound extends Error {}

export function detectCatalogMediaType(bytes: Uint8Array) {
  const image = detectImageType(bytes);

  if (image) return { kind: "image" as const, mimeType: image };

  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(4, 8)).toString() === "ftyp"
  )
    return { kind: "video" as const, mimeType: "video/mp4" };

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return { kind: "video" as const, mimeType: "video/webm" };

  return null;
}

function detectImageType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";

  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";

  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
  )
    return "image/webp";

  return null;
}

export async function putCatalogMedia(
  key: string,
  bytes: Uint8Array,
  contentType: string,
  options: {
    upsert?: boolean;
    abortSignal?: AbortSignal;
  } = {},
) {
  const r2 = getR2Storage();
  const headers = { "Content-Type": contentType };
  const response = await r2.request(key, {
    method: "PUT",
    headers: options.upsert ? headers : { ...headers, "If-None-Match": "*" },
    body: Buffer.from(bytes),
    signal: AbortSignal.any([
      AbortSignal.timeout(30_000),
      ...(options.abortSignal ? [options.abortSignal] : []),
    ]),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Media storage write failed (${response.status}${errorBody ? `: ${errorBody.slice(0, 200)}` : ""})`,
    );
  }

  await response.body?.cancel();
}

export async function deleteCatalogMedia(key: string) {
  const response = await getR2Storage().request(key, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });

  await response.body?.cancel();
  if (!response.ok) throw new Error("Media storage delete failed");
}

export async function getCatalogMedia(
  key: string,
  range?: string,
  abortSignal?: AbortSignal,
) {
  const response = await getR2Storage().request(key, {
    headers: range ? { Range: range } : undefined,
    signal: abortSignal,
  });

  if (response.status === 404) {
    if (/<Code>NoSuchBucket<\/Code>/.test(await response.text()))
      throw new Error("Media storage bucket not found");

    throw new CatalogMediaNotFound("Media object not found");
  }

  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("Media storage read failed");
  }

  return response.body;
}
