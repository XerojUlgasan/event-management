import { PublicCatalog } from "../PublicCatalog"
import type { PublicPackage } from "../../lib/api"

export function PackageCatalog({
  onViewMore,
  onAsk,
  selectionMode = false,
}: {
  onViewMore?: () => void
  onAsk?: (item: PublicPackage) => void
  selectionMode?: boolean
} = {}) {
  return <PublicCatalog kind="packages" onViewMore={onViewMore} onAsk={onAsk} selectionMode={selectionMode} />
}
