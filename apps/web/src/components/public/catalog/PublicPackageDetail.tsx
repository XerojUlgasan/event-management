import type { PublicPackage } from "../../../lib/data/catalog/packages";
import type { ReactNode } from "react";
import { PackageCanvas } from "../../catalog/CatalogContent";
import { PublicPackageBooking } from "./PublicPackageBooking";

export function PublicPackageDetail({
  item,
  children,
}: {
  item: PublicPackage;
  children?: ReactNode;
}) {
  return (
    <PackageCanvas
      item={item}
      bookingAction={children ?? <PublicPackageBooking item={item} />}
    />
  );
}
