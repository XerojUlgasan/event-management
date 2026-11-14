import type { CatalogSection } from "@event-management/contracts/catalog";
import { request } from "../../http/request";
import { pageQuery, type CatalogPageQuery } from "./page-query";

export type VenueContent = {
  name: string;
  location: string;
  description: string;
  maxGuests: number | null;
  sections: CatalogSection[];
};
export type Venue = VenueContent & {
  id: string;
  slug: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
export type AdminVenue = Venue;

export const getVenues = (page?: CatalogPageQuery) =>
  request<{ venues: Venue[]; nextCursor: string | null }>(
    `/venues${pageQuery(page)}`,
  );
export const getAdminVenues = (page?: CatalogPageQuery) =>
  request<{
    venues: AdminVenue[];
    nextCursor: string | null;
    counts: { active: number; archived: number; filtered: number };
  }>(`/admin/venues${pageQuery(page)}`);
export const getAdminVenue = (id: string) =>
  request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}`);
export const createVenue = (content: VenueContent) =>
  request<AdminVenue>("/admin/venues", content);
export const updateVenue = (
  id: string,
  content: VenueContent,
  expectedUpdatedAt: string,
) =>
  request<AdminVenue>(
    `/admin/venues/${encodeURIComponent(id)}`,
    { ...content, expectedUpdatedAt },
    undefined,
    "PATCH",
  );
export const archiveVenue = (id: string) =>
  request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}/archive`, {});
export const deleteVenue = (id: string) =>
  request<void>(
    `/admin/venues/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );
