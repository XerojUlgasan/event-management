import type { PublicService } from "../../lib/data/services"
import type { Venue } from "../../lib/data/venues"
import { PublicSections, publicMarkdown } from "./PublicSections"

export function serviceRateLabel(rate: number | null) {
  return rate == null ? "Rate not set" : `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(rate)} / hour`
}

export function PublicServiceDetail({ item }: { item: PublicService }) {
  return <div className="package-canvas-preview"><div className="canvas-intro"><h1>{item.name}</h1><div className="catalog-summary" dangerouslySetInnerHTML={{ __html: publicMarkdown(item.description) }} /><div><strong>{serviceRateLabel(item.hourlyRatePesos)}</strong></div></div><PublicSections sections={item.sections} /></div>
}

export function PublicVenueDetail({ item }: { item: Venue }) {
  return <div className="package-canvas-preview"><div className="canvas-intro"><h1>{item.name}</h1><p>{item.location}</p><p>{item.description}</p>{item.maxGuests != null && <div><strong>Up to {item.maxGuests} guests</strong></div>}</div><PublicSections sections={item.sections} /></div>
}
