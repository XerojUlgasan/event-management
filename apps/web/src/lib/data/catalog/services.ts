import type { CatalogSection } from "@event-management/contracts/catalog";
import { request } from "../../http/request";
import { pageQuery, type CatalogPageQuery } from "./page-query";

export type ServiceContent = {
  name: string;
  description: string;
  hourlyRatePesos: number | null;
  sections: CatalogSection[];
};
export type PublicService = ServiceContent & {
  imageUrl: string | null;
  id: string;
  slug: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};
export type AdminService = PublicService;

export const getAdminServices = (page?: CatalogPageQuery) =>
  request<{
    services: AdminService[];
    nextCursor: string | null;
    counts: { active: number; archived: number; filtered: number };
  }>(`/admin/services${pageQuery(page)}`);
export const getServices = (page?: CatalogPageQuery) =>
  request<{ services: PublicService[]; nextCursor: string | null }>(
    `/services${pageQuery(page)}`,
  );
export const getService = (id: string) =>
  request<PublicService>(`/services/${encodeURIComponent(id)}`);
export const getAdminService = (id: string) =>
  request<AdminService>(`/admin/services/${encodeURIComponent(id)}`);
export const createService = (content: ServiceContent) =>
  request<AdminService>("/admin/services", content);
export const updateService = (
  id: string,
  content: ServiceContent,
  expectedUpdatedAt: string,
) =>
  request<AdminService>(
    `/admin/services/${encodeURIComponent(id)}`,
    { ...content, expectedUpdatedAt },
    undefined,
    "PATCH",
  );
export const archiveService = (id: string) =>
  request<AdminService>(
    `/admin/services/${encodeURIComponent(id)}/archive`,
    {},
  );
export const deleteService = (id: string) =>
  request<void>(
    `/admin/services/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );
