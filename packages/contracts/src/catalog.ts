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
export type CatalogServicePreview = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
};
export type CatalogPackagePreview = CatalogServicePreview;
export type CatalogWidget = {
  id: string;
  type: "photo" | "markdown" | "video" | "service" | "package";
  x: number;
  y: number;
  w: number;
  h: number;
  markdown: string;
  media: CatalogMedia | null;
  alt: string;
  caption: string;
  autoplay: boolean;
  serviceId?: string | null;
  service?: CatalogServicePreview | null;
  packageId?: string | null;
  package?: CatalogPackagePreview | null;
};
export type CatalogSection = {
  id: string;
  title: string;
  widgets: CatalogWidget[];
};
export type ServicePricing = {
  hourlyRatePesos: number | null;
  fixedPricePesos: number | null;
  includedHours: number | null;
};
export type ServiceContent = ServicePricing & {
  name: string;
  description: string;
  sections: CatalogSection[];
};
export type PackagePrice = {
  kind: "fixed";
  currency: "PHP";
  amountMinor: number;
};
export type PackageContent = {
  name: string;
  description: string;
  maxGuests: number;
  price: PackagePrice;
  sections: CatalogSection[];
};
export type CatalogPackage = PackageContent & {
  packageType: "catalog" | "custom";
  customForBookingRequestId: string | null;
  id: string;
  slug: string;
  imageUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
