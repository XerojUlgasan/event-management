import type { PublicPackage } from "../../lib/data/packages"
import type { PublicService } from "../../lib/data/services"
import type { Venue } from "../../lib/data/venues"
import { packageImageSrc } from "../../lib/data/packages"
import { priceLabel } from "../../lib/utils/money"
import { photos } from "../app/data"

export function PackageCards({ items }: { items: PublicPackage[] }) {
  return <div className="catalog-grid">{items.map(item => <article className="catalog-card" key={item.id}><a href={`/packages/${item.slug}`}><div className="catalog-card-image"><img src={packageImageSrc(item.imageUrl) || photos.dinner} alt="" loading="lazy" /></div><div className="catalog-card-body"><span className="catalog-card-kicker">Event package</span><h3>{item.name}</h3><p>{item.description}</p><div className="catalog-card-meta"><span>{priceLabel(item.price)}</span><span>Up to {item.maxGuests} guests</span></div><span className="button button-secondary catalog-card-action">View package <span aria-hidden="true">↗</span></span></div></a></article>)}</div>
}

export function ServiceCards({ items }: { items: PublicService[] }) {
  return <div className="catalog-grid">{items.map(item => <article className="catalog-card" key={item.id}><a href={`/services/${item.slug}`}><div className="catalog-card-image">{item.imageUrl && <img src={packageImageSrc(item.imageUrl)} alt="" loading="lazy" />}</div><div className="catalog-card-body"><span className="catalog-card-kicker">Event service</span><h3>{item.name}</h3><p>{item.description}</p><span className="button button-secondary catalog-card-action">View service <span aria-hidden="true">↗</span></span></div></a></article>)}</div>
}

export function VenueCards({ items }: { items: Venue[] }) {
  return <div className="catalog-grid">{items.map(item => {
    const photo = item.sections.flatMap(section => section.widgets).find(widget => widget.type === "photo" && widget.media)?.media?.url
    return <article className="catalog-card" key={item.id}><a href={`/venues/${item.slug}`}><div className="catalog-card-image">{photo ? <img src={packageImageSrc(photo)} alt="" loading="lazy" /> : <span className="venue-photo-fallback">No venue photos available</span>}</div><div className="catalog-card-body"><span className="catalog-card-kicker">{item.location}</span><h3>{item.name}</h3><p>{item.description}</p><span className="button button-secondary catalog-card-action">View venue <span aria-hidden="true">↗</span></span></div></a></article>
  })}</div>
}
