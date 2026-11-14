import { PublicCatalog } from "./PublicCatalog";

export function PublicServiceCatalog({
  onViewMore,
}: {
  onViewMore?: () => void;
}) {
  return <PublicCatalog kind="services" onViewMore={onViewMore} />;
}
