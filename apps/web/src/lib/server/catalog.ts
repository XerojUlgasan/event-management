import type { PublicPackage } from "../data/packages"
import type { PublicService } from "../data/services"
import type { Venue } from "../data/venues"

function serverApiBase() {
  const proxy = process.env.API_PROXY_TARGET?.replace(/\/$/, "")
  if (proxy) return `${proxy}/functions/v1/api/v1`
  const configured = process.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000/v1"
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/$/, "")
  return "http://127.0.0.1:3000/v1"
}

async function serverGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${serverApiBase()}${path}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function loadPackages(limit?: number) {
  const page = await serverGet<{ packages: PublicPackage[] }>(`/packages${limit ? `?limit=${limit}` : ""}`)
  return page?.packages ?? []
}

export async function loadServices(limit?: number) {
  const page = await serverGet<{ services: PublicService[] }>(`/services${limit ? `?limit=${limit}` : ""}`)
  return page?.services ?? []
}

export async function loadVenues(limit?: number) {
  const page = await serverGet<{ venues: Venue[] }>(`/venues${limit ? `?limit=${limit}` : ""}`)
  return page?.venues ?? []
}

export function loadPackage(slug: string) {
  return serverGet<PublicPackage>(`/packages/slug/${encodeURIComponent(slug)}`)
}

export function loadService(slug: string) {
  return serverGet<PublicService>(`/services/slug/${encodeURIComponent(slug)}`)
}

export function loadVenue(slug: string) {
  return serverGet<Venue>(`/venues/slug/${encodeURIComponent(slug)}`)
}
