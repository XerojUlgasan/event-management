import type { PublicPackage } from "../../lib/data/packages"
import { priceLabel } from "../../lib/utils/money"
import { PublicSections } from "./PublicSections"

export function PublicPackageDetail({ item }: { item: PublicPackage }) {
  return <div className="package-canvas-preview"><div className="canvas-intro"><span>THE CLEMORA COLLECTION</span><h1>{item.name}</h1><div><strong>{priceLabel(item.price)}</strong><strong>Up to {item.maxGuests} guests</strong></div><a className="button button-primary canvas-book" href={`/login?book=${encodeURIComponent(item.slug)}`}>Book now</a></div>{item.services.length > 0 && <section><h2>Package services</h2><ul>{item.services.map(service => <li key={service.serviceId}>{service.name} · {service.role === "included" ? "Included" : "Optional"}</li>)}</ul></section>}<PublicSections sections={item.sections} /></div>
}
