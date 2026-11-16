import { readFile } from "node:fs/promises";

// The Edge build embeds these same checked-in files; never fetch arbitrary URLs.
export const sampleCatalogPhotoPaths = [
  "/images/wedding.jpg",
  "/images/dinner.jpg",
  "/images/dessert.jpg",
  "/images/hero.jpg",
];

export async function readSampleCatalogPhoto(url: string) {
  if (!sampleCatalogPhotoPaths.includes(url))
    throw new Error("Unknown catalog sample photo");
  return readFile(new URL(`../../../web/public${url}`, import.meta.url));
}
