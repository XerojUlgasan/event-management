import type { PublicPackage } from "../../lib/data/packages"
import { priceLabel } from "../../lib/utils/money"
import { PublicSections } from "./PublicSections"

export function PublicPackageDetail({ item }: { item: PublicPackage }) {
  return <div className="package-canvas-preview"><div className="canvas-intro"><span>THE CLEMORA COLLECTION</span><h1>{item.name}</h1><div><strong>{priceLabel(item.price)}</strong><strong>Up to {item.maxGuests} guests</strong></div><a className="button button-primary canvas-book" href={`/login?book=${encodeURIComponent(item.slug)}`}>Book now</a></div><PublicSections sections={item.sections} /></div>
}
