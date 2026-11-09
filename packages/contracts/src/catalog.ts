export const MAX_CATALOG_SECTIONS = 20;
export const MAX_CATALOG_WIDGETS = 100;
export const MAX_WIDGET_MARKDOWN_LENGTH = 20000;
export const CATALOG_COLUMNS = 12;

export type CatalogMedia = {
  id?: string;
  kind: "image" | "video";
  source: "upload" | "sample";
  url: string;
  mimeType?: string;
};
export type CatalogWidget = {
  id: string;
  type: "photo" | "markdown" | "video";
  x: number;
  y: number;
  w: number;
  h: number;
  markdown: string;
  media: CatalogMedia | null;
  alt: string;
  caption: string;
  autoplay: boolean;
};
export type CatalogSection = { id: string; title: string; widgets: CatalogWidget[] };
export type PackagePrice = { kind: "fixed"; currency: "PHP"; amountMinor: number };
export type PackageContent = {
  name: string;
  description: string;
  maxGuests: number;
  price: PackagePrice;
  sections: CatalogSection[];
};
export type CatalogPackage = PackageContent & {
  id: string;
  slug: string;
  imageUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};
