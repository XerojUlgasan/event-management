export const MAX_CATALOG_SECTIONS = 20;
export const MAX_CATALOG_WIDGETS = 100;
export const MAX_WIDGET_MARKDOWN_LENGTH = 20000;
export const CATALOG_COLUMNS = 12;
export const MAX_PACKAGE_SERVICES = 50;

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
export type PackageServiceRole = "included" | "optional";
export type PackageServiceInput = { serviceId: string; role: PackageServiceRole };
export type PackageServiceView = PackageServiceInput & {
  name?: string;
  archivedAt?: string | null;
};
export type PackageService = PackageServiceInput & {
  name: string;
  sortOrder: number;
  archivedAt: string | null;
};
export type PackageContent = {
  name: string;
  description: string;
  maxGuests: number;
  price: PackagePrice;
  sections: CatalogSection[];
  services: PackageServiceInput[];
};
export type CatalogPackage = Omit<PackageContent, "services"> & {
  services: PackageService[];
  id: string;
  imageUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  packageType: "catalog" | "custom";
  customForBookingRequestId: string | null;
  publishedAt: string | null;
};
