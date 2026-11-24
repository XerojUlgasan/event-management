import { config } from "../env.js";

function storageKey() {
  const direct =
    config.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    config.SUPABASE_SECRET_KEY?.trim();

  if (direct) return direct;

  const raw = config.SUPABASE_SECRET_KEYS?.trim();

  if (!raw) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);

    // Object.values also accepts arrays and primitive JSON values, as before.
    if (parsed === null || parsed === undefined) return undefined;

    const entries = Object.values(parsed);
    const candidate =
      (typeof parsed === "object" && "default" in parsed
        ? parsed.default
        : undefined) ?? entries[0];

    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export function getCatalogStorage() {
  const url = config.SUPABASE_URL?.trim().replace(/\/$/, "");
  const apiKey = storageKey();
  const bucket = config.SUPABASE_STORAGE_BUCKET?.trim() || "event-management";

  if (!url || !apiKey) throw new Error("Media storage is not configured");

  return { url, apiKey, bucket };
}

export class CatalogMediaNotFound extends Error {}

function objectPath(bucket: string, key: string) {
  return `${bucket}/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function authHeaders(apiKey: string, extra?: Record<string, string>) {
  return { apikey: apiKey, Authorization: `Bearer ${apiKey}`, ...extra };
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
    bucket?: string;
  } = {},
) {
  const { url, apiKey, bucket: defaultBucket } = getCatalogStorage();
  const bucket = options.bucket ?? defaultBucket;
  const response = await fetch(
    `${url}/storage/v1/object/${objectPath(bucket, key)}`,
    {
      method: "POST",
      headers: authHeaders(apiKey, {
        "Content-Type": contentType,
        "x-upsert": options.upsert ? "true" : "false",
      }),
      body: Buffer.from(bytes),
      signal: AbortSignal.any([
        AbortSignal.timeout(30_000),
        ...(options.abortSignal ? [options.abortSignal] : []),
      ]),
    },
  );

  if (!response.ok) throw new Error("Media storage write failed");
}

export async function deleteCatalogMedia(key: string, bucketOverride?: string) {
  const { url, apiKey, bucket: defaultBucket } = getCatalogStorage();
  const bucket = bucketOverride ?? defaultBucket;
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: authHeaders(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [key] }),
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 404) return;

  if (!response.ok) throw new Error("Media storage delete failed");
}

export async function getCatalogMedia(
  key: string,
  range?: string,
  abortSignal?: AbortSignal,
  bucketOverride?: string,
) {
  const { url, apiKey, bucket: defaultBucket } = getCatalogStorage();
  const bucket = bucketOverride ?? defaultBucket;
  const response = await fetch(
    `${url}/storage/v1/object/${objectPath(bucket, key)}`,
    {
      headers: authHeaders(apiKey, range ? { Range: range } : {}),
      signal: abortSignal,
    },
  );

  if (response.status === 400) {
    const error: unknown = await response.json().catch(() => null);

    // Some Storage versions wrap NoSuchKey (404) in an HTTP 400 response.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "NoSuchKey"
    )
      throw new CatalogMediaNotFound("Media object not found");
  }

  if (response.status === 404) {
    await response.body?.cancel();
    throw new CatalogMediaNotFound("Media object not found");
  }

  if (!response.ok || !response.body)
    throw new Error("Media storage read failed");

  return response.body;
}
