import type { PublicService } from "../../../lib/data/catalog/services";
import { ServiceCanvas } from "../../catalog/CatalogContent";

export function PublicServiceDetail({ item }: { item: PublicService }) {
  return <ServiceCanvas item={item} />;
}
