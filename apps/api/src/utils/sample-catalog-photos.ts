import { readFile } from "node:fs/promises";
import { sampleCatalogPhotoPaths } from "@event-management/contracts/catalog-canvas";

// The Edge build embeds these same checked-in files; never fetch arbitrary URLs.
export { sampleCatalogPhotoPaths };

export async function readSampleCatalogPhoto(url: string) {
  if (!sampleCatalogPhotoPaths.includes(url))
    throw new Error("Unknown catalog sample photo");

  return readFile(new URL(`../../../web/public${url}`, import.meta.url));
}
