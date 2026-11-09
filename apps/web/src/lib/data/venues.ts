import type { CatalogSection } from "@event-management/contracts/catalog"
import { request } from "../http"
import { pageQuery } from "./page-query"

export type VenueContent = {
  name: string
  location: string
  description: string
  maxGuests: number | null
  sections: CatalogSection[]
}
export type Venue = VenueContent & {
  id: string
  slug: string
  publishedAt: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}
export type AdminVenue = Venue

export const getVenues = (page?: { limit: number; offset?: number }) =>
  request<{ venues: Venue[]; nextOffset: number | null }>(`/venues${pageQuery(page)}`)
export const getAdminVenues = () => request<{ venues: AdminVenue[] }>("/admin/venues")
export const getAdminVenue = (id: string) =>
  request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}`)
export const createVenue = (content: VenueContent) =>
  request<AdminVenue>("/admin/venues", content)
export const updateVenue = (id: string, content: VenueContent, expectedUpdatedAt: string) =>
  request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}`, { ...content, expectedUpdatedAt }, undefined, "PATCH")
export const archiveVenue = (id: string) =>
  request<AdminVenue>(`/admin/venues/${encodeURIComponent(id)}/archive`, {})
export const deleteVenue = (id: string) =>
  request<void>(`/admin/venues/${encodeURIComponent(id)}`, undefined, undefined, "DELETE")
