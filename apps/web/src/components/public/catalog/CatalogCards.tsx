import { PackageCard, ServiceCard } from "../../catalog/CatalogListingCards";
import type { PublicPackage } from "../../../lib/data/catalog/packages";
import type { PublicService } from "../../../lib/data/catalog/services";

export function PackageCards({ items }: { items: PublicPackage[] }) {
  return (
    <div className="catalog-grid">
      {items.map((item) => (
        <PackageCard
          key={item.id}
          item={item}
          href={`/packages/${item.slug}`}
        />
      ))}
    </div>
  );
}

export function ServiceCards({ items }: { items: PublicService[] }) {
  return (
    <div className="catalog-grid">
      {items.map((item) => (
        <ServiceCard
          key={item.id}
          item={item}
          href={`/services/${item.slug}`}
        />
      ))}
    </div>
  );
}
