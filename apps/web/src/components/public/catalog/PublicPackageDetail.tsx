import type { PublicPackage } from "../../../lib/data/catalog/packages";
import { PackageCanvas } from "../../catalog/CatalogContent";

export function PublicPackageDetail({ item }: { item: PublicPackage }) {
  return (
    <PackageCanvas
      item={item}
      bookingAction={
        <a
          className="button button-primary"
          href={`/login?book=${encodeURIComponent(item.slug)}`}
        >
          Book now
        </a>
      }
    />
  );
}
