import type { EventType } from "./catalog-filters.js";

export const MAX_PACKAGE_ADDON_SERVICES = 100;

export const MAX_CATALOG_SECTIONS = 20;
export const MAX_CATALOG_WIDGETS = 100;
export const MAX_WIDGET_MARKDOWN_LENGTH = 20000;
export const CATALOG_COLUMNS = 24;
export const LEGACY_CATALOG_COLUMNS = 12;

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
  /** Dedicated card thumbnail. Null displays the shared default. */
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
  serviceTerms?: IncludedServiceTerms;
  service?: CatalogServicePreview | null;
  packageId?: string | null;
  package?: CatalogPackagePreview | null;
};

export type CatalogSection = {
  id: string;
  title: string;
  /** Omitted means legacy 12-column layout; only the current width is stored. */
  columns?: typeof CATALOG_COLUMNS;
  widgets: CatalogWidget[];
};

export type ServicePricing = {
  hourlyRatePesos: number | null;
  fixedPricePesos: number | null;
  includedHours: number | null;
};

export type IncludedServiceTerms = {
  includedHours: number | null;
  hourlyRatePesos: number | null;
};

export type PackageAddonService = ServicePricing & {
  id: string;
  serviceId: string;
  service?: CatalogServicePreview | null;
};

export type ServiceContent = ServicePricing & {
  name: string;
  description: string;
  sections: CatalogSection[];
  eventType?: EventType | null;
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
  eventType?: EventType | null;
};

export type CatalogPackage = PackageContent & {
  packageType: "catalog" | "custom";
  customForBookingRequestId: string | null;
  id: string;
  slug: string;
  /** Dedicated card thumbnail. Canvas photos do not supply a fallback. */
  imageUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  eventType: EventType | null;
};
