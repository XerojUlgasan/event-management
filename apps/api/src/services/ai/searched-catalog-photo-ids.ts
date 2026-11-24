type CatalogSearchStep = {
  toolResults: ReadonlyArray<{ toolName: string; output: unknown }>;
};

export function searchedCatalogPhotoIds(steps: readonly CatalogSearchStep[]) {
  const photos = new Set<string>();

  for (const { toolResults } of steps)
    for (const { toolName, output } of toolResults)
      if (
        toolName === "searchPublicCatalog" &&
        output &&
        typeof output === "object" &&
        "photoAttachmentId" in output &&
        typeof output.photoAttachmentId === "string"
      )
        photos.add(output.photoAttachmentId);

  return photos;
}
