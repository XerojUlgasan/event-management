const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function mediaFilename(id: string, mimeType: string) {
  const extension = extensions[mimeType];
  if (!extension) throw new Error("Unsupported catalog media type");
  return `${id}.${extension}`;
}

export function isCatalogMediaMimeType(mimeType: string) {
  return Object.hasOwn(extensions, mimeType);
}

export function pendingCatalogMediaKey(
  actorId: string,
  id: string,
  mimeType: string,
) {
  return `pending/${actorId}/${mediaFilename(id, mimeType)}`;
}

export function ownedCatalogMediaKey(
  owner: { kind: "package" | "service" | "booking"; id: string },
  media: { id: string; mime_type: string; kind: string },
) {
  const prefix =
    owner.kind === "booking"
      ? `bookings/${owner.id}/custom-package`
      : `${owner.kind === "package" ? "packages" : "services"}/${owner.id}`;
  const folder = media.kind === "image" ? "images" : "videos";
  return `${prefix}/${folder}/${mediaFilename(media.id, media.mime_type)}`;
}
