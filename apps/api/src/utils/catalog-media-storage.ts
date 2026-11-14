const DEFAULT_BUCKET = "event-management";

function configuredValue(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function serviceRoleKey() {
  const direct =
    configuredValue("SUPABASE_SERVICE_ROLE_KEY") ??
    configuredValue("SUPABASE_SECRET_KEY");
  if (direct) return direct;
  const raw = configuredValue("SUPABASE_SECRET_KEYS");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = parsed.default ?? Object.values(parsed)[0];
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function storage() {
  const url = configuredValue("SUPABASE_URL")?.replace(/\/$/, "");
  const apiKey = serviceRoleKey();
  const bucket = configuredValue("SUPABASE_STORAGE_BUCKET") ?? DEFAULT_BUCKET;
  if (!url || !apiKey) throw new Error("Media storage is not configured");
  return { url, apiKey, bucket };
}

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
) {
  const { url, apiKey, bucket } = storage();
  const response = await fetch(
    `${url}/storage/v1/object/${objectPath(bucket, key)}`,
    {
      method: "POST",
      headers: authHeaders(apiKey, {
        "Content-Type": contentType,
        "x-upsert": "false",
      }),
      body: Buffer.from(bytes),
    },
  );
  if (!response.ok) throw new Error("Media storage write failed");
}

export async function deleteCatalogMedia(key: string) {
  const { url, apiKey, bucket } = storage();
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: authHeaders(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [key] }),
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error("Media storage delete failed");
}

export async function getCatalogMedia(key: string, range?: string) {
  const { url, apiKey, bucket } = storage();
  const response = await fetch(
    `${url}/storage/v1/object/${objectPath(bucket, key)}`,
    {
      headers: authHeaders(apiKey, range ? { Range: range } : {}),
    },
  );
  if (!response.ok || !response.body)
    throw new Error("Media storage read failed");
  return response.body;
}
