import { AwsClient } from "aws4fetch";
import { config } from "../env.js";

export class CatalogMediaNotFound extends Error {}

type StorageArea = "supporting-documents";

export function getCatalogStorage() {
  const endpointValue = config.R2_ENDPOINT?.trim();
  const accessKeyId = config.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = config.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = config.R2_BUCKET_NAME?.trim();

  if (!endpointValue || !accessKeyId || !secretAccessKey || !bucket)
    throw new Error(
      "Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME",
    );

  const endpoint = URL.parse(endpointValue);

  if (
    !endpoint ||
    !["https:", "http:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error(
      "R2_ENDPOINT must be an HTTP(S) endpoint without credentials or query parameters",
    );

  return {
    endpoint: endpoint.href.replace(/\/+$/, ""),
    bucket,
    client: new AwsClient({
      accessKeyId,
      secretAccessKey,
      region: config.R2_REGION?.trim() || "auto",
      service: "s3",
      retries: 0,
    }),
  };
}

function storageObject(key: string, area?: StorageArea) {
  const { endpoint, bucket, client } = getCatalogStorage();
  const documentBucket = area && config.R2_DOCUMENTS_BUCKET_NAME?.trim();
  const objectKey = area && !documentBucket ? `${area}/${key}` : key;
  const path = objectKey.split("/").map(encodeURIComponent).join("/");

  return {
    client,
    url: `${endpoint}/${encodeURIComponent(documentBucket || bucket)}/${path}`,
    // The local Supabase S3 endpoint ignores If-None-Match on PutObject.
    needsExistenceCheck: endpoint.endsWith("/storage/v1/s3"),
  };
}

async function fetchObject(client: AwsClient, url: string, init: RequestInit) {
  const signingUrl = new URL(url);
  const localSigningHost = config.R2_LOCAL_SIGNING_HOST?.trim();
  const useLocalHost = signingUrl.hostname === "kong" && localSigningHost;

  // Local Kong forwards its internal hostname with the published API port.
  if (useLocalHost) signingUrl.host = useLocalHost;

  const signed = await client.sign(signingUrl, init);

  return fetch(url, {
    ...init,
    headers: signed.headers,
    redirect: "error",
  });
}

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
    area?: StorageArea;
  } = {},
) {
  const { client, url, needsExistenceCheck } = storageObject(key, options.area);
  const signal = AbortSignal.any([
    AbortSignal.timeout(30_000),
    ...(options.abortSignal ? [options.abortSignal] : []),
  ]);

  if (needsExistenceCheck && !options.upsert) {
    const existing = await fetchObject(client, url, { method: "HEAD", signal });

    if (existing.status !== 404) throw new Error("Media storage write failed");
  }

  const response = await fetchObject(client, url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      ...(options.upsert ? {} : { "If-None-Match": "*" }),
    },
    body: Buffer.from(bytes),
    signal,
  });
  await response.body?.cancel();

  if (!response.ok) throw new Error("Media storage write failed");
}

export async function deleteCatalogMedia(key: string, area?: StorageArea) {
  const { client, url } = storageObject(key, area);
  const response = await fetchObject(client, url, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });
  await response.body?.cancel();

  if (!response.ok && response.status !== 404)
    throw new Error("Media storage delete failed");
}

export async function getCatalogMedia(
  key: string,
  range?: string,
  abortSignal?: AbortSignal,
  area?: StorageArea,
) {
  const { client, url } = storageObject(key, area);
  const response = await fetchObject(client, url, {
    headers: range ? { Range: range } : {},
    signal: abortSignal,
  });

  if (!response.ok || !response.body) {
    await response.body?.cancel();

    if (response.status === 404)
      throw new CatalogMediaNotFound("Media object not found");

    throw new Error("Media storage read failed");
  }

  return response.body;
}
