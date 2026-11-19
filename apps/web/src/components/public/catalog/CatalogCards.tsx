import type { PublicPackage } from "../../../lib/data/catalog/packages";
import type { PublicService } from "../../../lib/data/catalog/services";
import { packageImageSrc } from "../../../lib/data/catalog/packages";
import {
  priceLabel,
  servicePricingLabels,
} from "../../../lib/utils/formatting/money";
import { CatalogThumbnail } from "@event-management/ui";

export function PackageCards({ items }: { items: PublicPackage[] }) {
  return (
    <div className="catalog-grid">
      {items.map((item) => (
        <article className="catalog-card" key={item.id}>
          <a href={`/packages/${item.slug}`}>
            <div className="catalog-card-image">
              <CatalogThumbnail src={packageImageSrc(item.imageUrl)} />
            </div>
            <div className="catalog-card-body">
              <span className="catalog-card-kicker">Event package</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="catalog-card-meta">
                <span>{priceLabel(item.price)}</span>
                <span>Up to {item.maxGuests} guests</span>
              </div>
              <span className="button button-secondary catalog-card-action">
                View package <span aria-hidden="true">↗</span>
              </span>
            </div>
          </a>
        </article>
      ))}
    </div>
  );
}

export function ServiceCards({ items }: { items: PublicService[] }) {
  return (
    <div className="catalog-grid">
      {items.map((item) => {
        const pricing = servicePricingLabels(item);

        return (
          <article className="catalog-card" key={item.id}>
            <a href={`/services/${item.slug}`}>
              <div className="catalog-card-image">
                <CatalogThumbnail src={packageImageSrc(item.imageUrl)} />
              </div>
              <div className="catalog-card-body">
                <span className="catalog-card-kicker">Event service</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="catalog-card-meta">
                  <span>{pricing.price}</span>
                  {pricing.excess && <span>{pricing.excess}</span>}
                </div>
                <span className="button button-secondary catalog-card-action">
                  View service <span aria-hidden="true">↗</span>
                </span>
              </div>
            </a>
          </article>
        );
      })}
    </div>
  );
}
