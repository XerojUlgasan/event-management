import { PublicCatalog } from "./PublicCatalog";

export function PackageCatalog({
  onViewMore,
}: { onViewMore?: () => void } = {}) {
  return <PublicCatalog kind="packages" onViewMore={onViewMore} />;
}
