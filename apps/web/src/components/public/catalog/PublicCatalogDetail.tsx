import type { PublicService } from "../../../lib/data/catalog/services";
import type { Venue } from "../../../lib/data/catalog/venues";
import { ServiceCanvas, VenueCanvas } from "../../catalog/CatalogContent";

export function PublicServiceDetail({ item }: { item: PublicService }) {
  return <ServiceCanvas item={item} />;
}

export function PublicVenueDetail({ item }: { item: Venue }) {
  return <VenueCanvas item={item} />;
}
