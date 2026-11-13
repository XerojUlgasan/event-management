import { Button, NativeDialog } from "@event-management/ui"
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PackageContent } from "@event-management/contracts/catalog"
import type { PublicPackage } from "../../lib/data/packages"
import { editorCanvasWidth } from "../../lib/utils/editor-canvas"
import { priceLabel } from "../../lib/utils/money"
import { CanvasPreviewStage } from "./CanvasPreviewStage"
import { CatalogSections } from "./CatalogSections"
import { BookingRequestDialog } from "./BookingRequest"

export { priceLabel }
export function PackageCanvas({
  item,
  hideServices = false,
}: {
  item: Omit<PackageContent, "services"> & {
    services: {
      serviceId: string;
      name?: string;
      role: "included" | "optional";
    }[];
  };
  hideServices?: boolean;
}) {
  return (
    <main className="package-canvas-preview">
      <div className="canvas-intro">
        <span>THE CLEMORA COLLECTION</span>
        <h1>{item.name || "Untitled package"}</h1>
        <div>
          <strong>{priceLabel(item.price)}</strong>
          <strong>Up to {item.maxGuests} guests</strong>
        </div>
      </div>
      {!hideServices && item.services && item.services.length > 0 && (
        <section>
          <h2>Package services</h2>
          <ul>
            {item.services.map((service) => (
              <li key={service.serviceId}>
                {service.name ?? "Service"} ·{" "}
                {service.role === "included" ? "Included" : "Optional"}
              </li>
            ))}
          </ul>
        </section>
      )}
      <CatalogSections sections={item.sections} />
    </main>
  );
}
export function PackagePreview({ item, loading = false, error = "", onClose, allowBooking = true }: { item: PublicPackage | null; loading?: boolean; error?: string; allowBooking?: boolean; onClose: () => void }) {
  const [booking, setBooking] = useState(false)
  const [canvasWidth] = useState(() => typeof window === "undefined" ? 0 : editorCanvasWidth(window.innerWidth))
  const dialogRef = useRef<HTMLDialogElement>(null), titleId = useId()
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const dialog = dialogRef.current; const overflow = document.body.style.overflow; dialog?.showModal(); document.body.style.overflow = "hidden"; return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus() } }, [])
  useEffect(() => { if (!booking && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal() }, [booking])
  return createPortal(<><NativeDialog ref={dialogRef} className="package-preview" aria-label="Package preview" onCancel={e => { e.preventDefault(); onClose() }}><header className="package-preview-bar"><Button variant="plain" className="package-preview-close" onClick={onClose} aria-label="Close package preview">×</Button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" /><span className="package-preview-label" id={titleId}>Package preview</span>{item && allowBooking && <Button className="canvas-book" onClick={() => { dialogRef.current?.close(); setBooking(true) }}>Book now</Button>}</header><div className="package-preview-scroll">{loading && <p role="status">Loading package…</p>}{error && <p role="alert">{error}</p>}{item && <CanvasPreviewStage width={canvasWidth}><PackageCanvas item={item} /></CanvasPreviewStage>}</div></NativeDialog>{booking && item && <BookingRequestDialog item={item} onClose={() => setBooking(false)} />}</>, document.body)
}
