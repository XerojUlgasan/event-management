export function imageId(url: string | null) {
  return url?.match(/^\/v1\/package-images\/([0-9a-f-]+)$/i)?.[1]?.toLowerCase() ?? null;
}
