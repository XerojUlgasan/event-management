import type { CatalogPackage, PackageContent } from "@event-management/contracts/catalog"
import { request } from "../http"
import { catalogMediaSrc } from "./catalog-media"
import { pageQuery } from "./page-query"

export type { PackagePrice, PackageContent, CatalogMedia, CatalogWidget, CatalogSection } from "@event-management/contracts/catalog"
export type PublicPackage = CatalogPackage
export type AdminPackage = CatalogPackage

export const getPackages = (page?: { limit: number; offset?: number }) =>
  request<{ packages: PublicPackage[]; nextOffset: number | null }>(`/packages${pageQuery(page)}`)
export const getPackage = (id: string) =>
  request<PublicPackage>(`/packages/${encodeURIComponent(id)}`)
export const getAdminPackages = () => request<{ packages: AdminPackage[] }>("/admin/packages")
export const getAdminPackage = (id: string) =>
  request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`)
export const createPackage = (content: PackageContent) =>
  request<AdminPackage>("/admin/packages", content)
export const updatePackage = (id: string, content: PackageContent, expectedUpdatedAt: string) =>
  request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`, { ...content, expectedUpdatedAt }, undefined, "PATCH")
export const archivePackage = (id: string) =>
  request<AdminPackage>(`/admin/packages/${encodeURIComponent(id)}/archive`, {})
export const deletePackage = (id: string) =>
  request<void>(`/admin/packages/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")
export const packageImageSrc = (imageUrl: string | null): string | undefined =>
  imageUrl ? catalogMediaSrc(imageUrl) : undefined
