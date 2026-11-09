import { Button, NativeDialog } from "@event-management/ui"
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PackageContent, PackagePrice } from "@event-management/contracts/catalog"
import type { PublicPackage } from "../../lib/data/packages"
import { centavosToPesos } from "../../lib/utils/money"
import { CatalogSections } from "./CatalogSections"
import { BookingRequestDialog } from "./BookingRequest"

export function priceLabel(price: PackagePrice | null) {
  return price ? `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(centavosToPesos(price.amountMinor))} total` : "Price on request"
}
export function PackageCanvas({ item }: { item: PackageContent }) {
  return <main className="package-canvas-preview"><div className="canvas-intro"><span>THE CLEMORA COLLECTION</span><h1>{item.name || "Untitled package"}</h1><div><strong>{priceLabel(item.price)}</strong><strong>Up to {item.maxGuests} guests</strong></div></div><CatalogSections sections={item.sections} /></main>
}
export function PackagePreview({ item, loading = false, error = "", onClose, allowBooking = true }: { item: PublicPackage | null; loading?: boolean; error?: string; allowBooking?: boolean; onClose: () => void }) {
  const [booking, setBooking] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null), titleId = useId()
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const dialog = dialogRef.current; const overflow = document.body.style.overflow; dialog?.showModal(); document.body.style.overflow = "hidden"; return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus() } }, [])
  useEffect(() => { if (!booking && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal() }, [booking])
  return createPortal(<><NativeDialog ref={dialogRef} className="package-preview" aria-label="Package preview" onCancel={e => { e.preventDefault(); onClose() }}><header className="package-preview-bar"><Button variant="plain" className="package-preview-close" onClick={onClose} aria-label="Close package preview">×</Button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" /><span className="package-preview-label" id={titleId}>Package preview</span>{item && allowBooking && <Button className="canvas-book" onClick={() => { dialogRef.current?.close(); setBooking(true) }}>Book now</Button>}</header><div className="package-preview-scroll">{loading && <p role="status">Loading package…</p>}{error && <p role="alert">{error}</p>}{item && <PackageCanvas item={item} />}</div></NativeDialog>{booking && item && <BookingRequestDialog item={item} onClose={() => setBooking(false)} />}</>, document.body)
}
