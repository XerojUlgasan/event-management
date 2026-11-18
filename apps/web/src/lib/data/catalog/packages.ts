import type { PublicCatalogPageQuery } from "@event-management/contracts/catalog-filters";
import type {
  CatalogPackage,
  PackageContent,
} from "@event-management/contracts/catalog";
import { request } from "../../http/request";
import { catalogMediaSrc } from "./media";
import { pageQuery, type CatalogPageQuery } from "./page-query";

export type {
  PackagePrice,
  PackageContent,
  CatalogMedia,
  CatalogWidget,
  CatalogSection,
} from "@event-management/contracts/catalog";
export type PublicPackage = CatalogPackage;
export type AdminPackage = CatalogPackage;

export const getPackages = (page?: PublicCatalogPageQuery) =>
  request<{ packages: PublicPackage[]; nextCursor: string | null }>(
    `/packages${pageQuery(page)}`,
  );
export const getPackage = (id: string) =>
  request<PublicPackage>(`/packages/${encodeURIComponent(id)}`);
export const getPackageBySlug = (slug: string) =>
  request<PublicPackage>(`/packages/slug/${encodeURIComponent(slug)}`);
export const getAdminPackages = (page?: CatalogPageQuery) =>
  request<{
    packages: AdminPackage[];
    nextCursor: string | null;
    counts: { active: number; archived: number; filtered: number };
  }>(`/admin/packages${pageQuery(page)}`);
export const getAdminPackage = (id: string) =>
  request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`);
export const createPackage = (
  content: PackageContent,
  thumbnailMediaId?: string | null,
) =>
  request<AdminPackage>("/admin/packages", {
    ...content,
    ...(thumbnailMediaId !== undefined ? { thumbnailMediaId } : {}),
  });
export const updatePackage = (
  id: string,
  content: PackageContent,
  expectedUpdatedAt: string,
  thumbnailMediaId?: string | null,
) =>
  request<AdminPackage>(
    `/admin/packages/${encodeURIComponent(id)}`,
    {
      ...content,
      expectedUpdatedAt,
      // Only include thumbnailMediaId when the user explicitly changed it this
      // session. `undefined` means untouched — omitting it preserves the DB value.
      ...(thumbnailMediaId !== undefined ? { thumbnailMediaId } : {}),
    },
    undefined,
    "PATCH",
  );
export const archivePackage = (id: string) =>
  request<AdminPackage>(
    `/admin/packages/${encodeURIComponent(id)}/archive`,
    {},
  );
export const deletePackage = (id: string) =>
  request<void>(
    `/admin/packages/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );
export const packageImageSrc = (imageUrl: string | null): string | undefined =>
  imageUrl ? catalogMediaSrc(imageUrl) : undefined;
